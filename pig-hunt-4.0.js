

//This script searches the network for low security, high-yield servers.

import { GetReadableDateDelta } from "utility.js"
import { GetTotalAvailableThreadsForScript } from "utility.js"
import { GetMaxThreadsForScript } from "utility.js"
import { GetThreadCountForScript } from "utility.js"
import { GetMaxThreadCountForScript } from "utility.js"
import { GetTotalThreadsRunningScriptOnNetwork } from "utility.js"
import { GetTotalThreadsRunningScriptOnHome } from "utility.js"
import { GetTotalAvailableRamOnNetwork } from "utility.js"
import { GetMaxRamOnNetwork } from "utility.js"
import { DistributeScriptsToNetwork } from "utility.js"
import { DistribueScriptsToHome } from "utility.js"
import { KillDuplicateScriptsOnHost } from "utility.js"


/** @param {NS} ns */
function ServerData( name, money, maxMoney, securityLevel, secMinLevel, hackingLevel, hackingTime, 
totalGrowingTime, totalWeakeningTime, hackPercentage, requiredGrowThreads, requiredWeakenThreads, requiredHackThreads )
{
  this.name                   = name
  this.money                  = money
  this.maxMoney               = maxMoney
  this.securityLevel          = securityLevel
  this.secMinLevel            = secMinLevel
  this.hackingLevel           = hackingLevel
  this.hackingTime            = hackingTime
  this.totalGrowingTime       = totalGrowingTime
  this.totalWeakeningTime     = totalWeakeningTime
  this.requiredGrowThreads    = requiredGrowThreads
  this.requiredWeakenThreads  = requiredWeakenThreads
  this.requiredHackThreads    = requiredHackThreads
  this.requiredTotalThreads   = requiredGrowThreads + requiredWeakenThreads + requiredHackThreads
  this.totalTime              = hackingTime + totalGrowingTime + totalWeakeningTime

  this.totalTimeDevReadable   = this.requiredHackThreads > 0 ? "Finished Hacking In: " + GetReadableDateDelta( this.hackingTime ) : "Can Hacking In: " + GetReadableDateDelta( this.totalGrowingTime + this.totalWeakeningTime )

  this.hackPercentage = hackPercentage
  this.heuristic      = this.requiredHackThreads > 0 ? -this.hackingTime : this.totalGrowingTime + this.totalWeakeningTime //GetTimeForEarningRatio( this.totalTime, maxMoney * hackPercentage )
}

function GrowthThreadData( requiredThreads, activeThreads )
{
  this.requiredThreads = requiredThreads
  this.activeThreads = activeThreads
}

const PIG_HUNT_DEBUG_PRINTS = false
const GROW_THREAD_SECURITY_DELTA = 0.004 //This is a constant in the game.
const HACK_THREAD_SECURITY_DELTA = 0.002 //This is an aproximation.
const ACCOUNT_HACK_ADJUSTMENT_PERCENTILE = 0.01
const ACCOUNT_HACK_PERCENTILE = 0.2

//The max percentage of ram threads allocated by this script can use on our home server, we always want head room to run other scripts.
const HOME_SERVER_MAX_RAM_USAGE = 0.75

/*
For non-hack operations, we will only run threads on our home server that will be complted within the given ms timeframe. This is to keep threads turning over
to ensure any available hacks are executed promptly and don't hold up the server farm's thread allocation chain.
*/
const HOME_SERVER_MAX_TIME_UNTIL_THREAD_FINISHED = 60000

export async function main(ns) 
{

  /*
  TO DO: save the results of a server to a file and only recompute 
  if hackTime, growTime, or weakenTime is diffrent from last cycle.
  */

  //const farmingScript = "farm-server.js"

  //TO DO: Because we will have three seperate scripts the thread estimations will be diffrent.
  //We many need to allocate by ram rather than threads.
  const hackScript      = "server-hack.js"
  const weakenScript    = "server-weaken.js"
  const growScript      = "server-grow.js"
  const shareScript     = "server-share.js"

  const hackScriptRam       = ns.getScriptRam( hackScript )
  const weakenScriptRam     = ns.getScriptRam( weakenScript )
  const growScriptRam       = ns.getScriptRam( growScript )
  const shareScriptRam      = ns.getScriptRam( shareScript )

  //For now assign the farming script for the search to be the script with the highest ram cost.
  let farmingScript = hackScript
  let highestRamCost = hackScriptRam

  if ( weakenScriptRam > highestRamCost )
  {
    farmingScript   = weakenScript
    highestRamCost  = weakenScriptRam
  }
  
  if ( growScriptRam > highestRamCost )
  {
    farmingScript   = growScript
    highestRamCost  = growScriptRam
  }

  let accountHackPercentile = ACCOUNT_HACK_PERCENTILE
  if ( ns.args.length > 0 )
    accountHackPercentile = ns.args[0]

  if ( accountHackPercentile > 1.0 )
  {
    ns.tprint( "Attempting to hack servers for more than 100% of their account money, please enter value less than or equal to 1.0" )
    ns.tprint( "Terminating Script." )
    return
  }
  else if ( accountHackPercentile <= 0.0 )
  {
    ns.tprint( "Attempting to hack servers for less than 1% of their account money, please enter value greater than 0.0" )
    ns.tprint( "Terminating Script." )
    return
  }

  const parentServer = ns.getHostname()

  ns.print( "parent server: " + parentServer )

  //Only allow one gang manager to run at a time.
  KillDuplicateScriptsOnHost( ns, ns.getRunningScript() )

  while ( true )
  {

    if ( PIG_HUNT_DEBUG_PRINTS )
    {
      ns.tprint("\n")
      ns.tprint("/////////////////////////////////")
      ns.tprint( "Starting New Server Evaluation")
      ns.tprint("/////////////////////////////////")
    }
    

    let searchStartTime = new Date()

    let searchedServers = await ServerSearch( ns, parentServer, parentServer, accountHackPercentile, farmingScript, weakenScript, growScript, hackScript )

    let searchEndTime = new Date()

    if ( PIG_HUNT_DEBUG_PRINTS )
      ns.tprint( "Server search completed after " + GetReadableDateDelta( searchEndTime.getTime() - searchStartTime.getTime() ) )

    searchedServers.sort( (a, b) => a.heuristic - b.heuristic )

    //We are relying on the fact that our work scripts kill themselves when they are done.
    /*
    if ( searchedServers.length > 0 )
    {
      KillAllNetworkProcesses( ns, "home", "home" )
    }
    */

    let totalRequiredThreads = 0;
    for ( let i = 0; i < searchedServers.length; i++ )
    {
      let sortedServer = searchedServers[ i ]
      totalRequiredThreads += sortedServer.requiredTotalThreads 
    }

    //Determine how many threads we can run on home as an overflow if needed.
    const maxHomeThreadsPossible    = GetMaxThreadCountForScript( ns, farmingScript, "home" )
    const totalHomeThreadsAvailable = GetThreadCountForScript( ns, farmingScript, "home" )

    const minFreeThreadsFrac = Math.floor( maxHomeThreadsPossible - ( maxHomeThreadsPossible * HOME_SERVER_MAX_RAM_USAGE ) )
    let clampedAvailableHomeThreads = totalHomeThreadsAvailable > minFreeThreadsFrac ? Math.floor( totalHomeThreadsAvailable - minFreeThreadsFrac ) : 0

    const maxNetworkThreadsPossible = GetMaxThreadsForScript( ns, "home", "home", farmingScript )
    let totalNetworkThreadsAvailable = GetTotalAvailableThreadsForScript( ns, "home", "home", farmingScript )
    let totalNetworkThreadsAllocated = 0

    let shortestHackTime = 1000

    for ( let i = 0; i < searchedServers.length; i++  )
    {

      const remainingThreadsAvailable = totalNetworkThreadsAvailable - totalNetworkThreadsAllocated

      if ( remainingThreadsAvailable <= 0 && clampedAvailableHomeThreads <= 0 )
        break 

      let sortedServer = searchedServers[ i ]

      //Skip servers with no monatary value.
      //if ( sortedServer.heuristic <= 0  )
      //  continue

      if ( sortedServer.requiredTotalThreads == 0 )
        continue

      const hackingTime       = ns.getHackTime( sortedServer.name )
      const growingTime       = ns.getGrowTime( sortedServer.name )
      const weakeningTime     = ns.getWeakenTime( sortedServer.name )

      const scriptNameList = [ growScript, weakenScript, hackScript ]
      const scriptArgsList = [ [sortedServer.name], [sortedServer.name], [sortedServer.name] ]

      let clampedGrowThreads    = sortedServer.requiredGrowThreads
      let clampedWeakenThreads  = sortedServer.requiredWeakenThreads
      let clampedHackThreads    = sortedServer.requiredHackThreads

      //Ensure max strength hack.
      if ( maxNetworkThreadsPossible < clampedHackThreads + clampedWeakenThreads && clampedHackThreads > 0 )
      {
        //we only want to hack when we can hack at full thread power, or we are using all our current resources to the best hack we can.
        if ( maxNetworkThreadsPossible > remainingThreadsAvailable )
        {

          //If we can run the threads on our home server to unblock our server farm, do it.
          if ( clampedAvailableHomeThreads >= clampedHackThreads + clampedWeakenThreads && clampedHackThreads > 0 )
          {
            const homeScriptNameList = [ hackScript, weakenScript ]
            const homeScriptArgsList = [ [sortedServer.name], [sortedServer.name] ]
            const homeThreadCountList = [ clampedHackThreads, clampedWeakenThreads ]

            clampedAvailableHomeThreads -= DistribueScriptsToHome( ns, homeScriptNameList, homeScriptArgsList, homeThreadCountList )
            continue
          }
          else
          {
            //Skip all lower priorty servers till we can hack this one.
            totalNetworkThreadsAllocated = totalNetworkThreadsAvailable
            break
          }
        }
      }
      else
      {
        if ( remainingThreadsAvailable < clampedHackThreads + clampedWeakenThreads && clampedHackThreads > 0 )
        {
          //If we can run the threads on our home server to unblock our server farm, do it.
          if ( clampedAvailableHomeThreads >= clampedHackThreads )
          {
            const homeScriptNameList = [ hackScript, weakenScript ]
            const homeScriptArgsList = [ [sortedServer.name], [sortedServer.name] ]
            const homeThreadCountList = [ clampedHackThreads, clampedWeakenThreads ]

            clampedAvailableHomeThreads -= DistribueScriptsToHome( ns, homeScriptNameList, homeScriptArgsList, homeThreadCountList )
            continue
          }
          else
          {
            //Skip all lower priorty servers till we can hack this one.
            totalNetworkThreadsAllocated = totalNetworkThreadsAvailable
            break
          }
        }
      }          

      let maxTimeUntilThreadFinished = 0
      if ( clampedGrowThreads > maxTimeUntilThreadFinished )
        maxTimeUntilThreadFinished = growingTime 
        
      if ( clampedWeakenThreads > maxTimeUntilThreadFinished )
        maxTimeUntilThreadFinished += weakeningTime

      // if we could run this on our home machine, try that before allocating to farm, if the time to get the server to a hack is less than our max allowable time.
      if ( (sortedServer.requiredTotalThreads <= clampedAvailableHomeThreads || remainingThreadsAvailable == 0) && maxTimeUntilThreadFinished <= HOME_SERVER_MAX_TIME_UNTIL_THREAD_FINISHED)
      {
        let homeClampedGrowThreads   = clampedGrowThreads
        let homeClampedWeakenThreads = clampedWeakenThreads
        let homeClampedHackThreads   = clampedHackThreads

        let threadAllocationClampedOnHome = false
        if ( sortedServer.requiredTotalThreads > clampedAvailableHomeThreads )
        {
          const threadsNeededScalar = clampedAvailableHomeThreads / sortedServer.requiredTotalThreads
          homeClampedGrowThreads    = Math.round( clampedGrowThreads * threadsNeededScalar )
          homeClampedWeakenThreads  = Math.round( clampedWeakenThreads * threadsNeededScalar )
          homeClampedHackThreads    = Math.round( clampedHackThreads * threadsNeededScalar )

          const postScaleTotalThreadsNeeded  = homeClampedWeakenThreads + homeClampedGrowThreads + homeClampedHackThreads

          if ( postScaleTotalThreadsNeeded > clampedAvailableHomeThreads )
            debugger

          threadAllocationClampedOnHome = true
        }

        const threadCountList = [ homeClampedGrowThreads, homeClampedWeakenThreads, homeClampedHackThreads ]
        const totalHomeThreadsAllocated = DistribueScriptsToHome( ns, scriptNameList, scriptArgsList, threadCountList )
        
        clampedGrowThreads    -= homeClampedGrowThreads
        clampedWeakenThreads  -= homeClampedWeakenThreads
        clampedHackThreads    -= homeClampedHackThreads
        sortedServer.requiredTotalThreads -= totalHomeThreadsAllocated

        clampedAvailableHomeThreads -= totalHomeThreadsAllocated

        if ( !threadAllocationClampedOnHome )
          continue
      }

      if ( remainingThreadsAvailable <= 0 )
        continue 

      //If we don't have enough threads, we want to scale down our thread requirements by a uniform scalar so that we still run some of each of our required threads.
      if ( sortedServer.requiredTotalThreads > remainingThreadsAvailable )
      {
        const threadsNeededScalar = remainingThreadsAvailable / sortedServer.requiredTotalThreads
        clampedGrowThreads    = Math.round( clampedGrowThreads * threadsNeededScalar )
        clampedWeakenThreads  = Math.round( clampedWeakenThreads * threadsNeededScalar )
        clampedHackThreads    = Math.round( clampedHackThreads * threadsNeededScalar )

        const postScaleTotalThreadsNeeded  = clampedWeakenThreads + clampedGrowThreads + clampedHackThreads

        if ( postScaleTotalThreadsNeeded > remainingThreadsAvailable )
          debugger
      } 

      const threadCountList = [ clampedGrowThreads, clampedWeakenThreads, clampedHackThreads ]
    
      const threadsAllocated    = DistributeScriptsToNetwork( ns, scriptNameList, scriptArgsList, threadCountList )
        
      if ( threadsAllocated <= 0 && sortedServer.requiredTotalThreads > 0 )
        break

      if ( hackingTime < shortestHackTime )
        shortestHackTime = hackingTime

      if ( growingTime < shortestHackTime )
        shortestHackTime = growingTime

      if ( weakeningTime < shortestHackTime )
        shortestHackTime = weakeningTime

      totalNetworkThreadsAllocated += threadsAllocated   
    }

    const unallocatedThreadCount = totalNetworkThreadsAvailable - totalNetworkThreadsAllocated
    
    //if we have unallocated threads and we're not hacking 100% of targeted accounts.
    if ( unallocatedThreadCount > 0 && accountHackPercentile < 1.0 )
    {
      accountHackPercentile = Math.min( accountHackPercentile + ACCOUNT_HACK_ADJUSTMENT_PERCENTILE, 1.0 )
    } 
    else if ( unallocatedThreadCount == 0 )
    {
      //Cover the case where more servers open up to hacking and we need to reduce our hack percentile to not overhack new servers.
      accountHackPercentile = ACCOUNT_HACK_PERCENTILE
    }

    if ( unallocatedThreadCount > 0 )
    {
      //Share 75% of our remaining unused ram with our factions.)
      const existingShareThreads    = GetTotalThreadsRunningScriptOnNetwork( ns, "home", "home", shareScript, [] )
      const maxShareThreadsPossible = GetMaxThreadsForScript( ns, "home", "home", shareScript )
      
      const totalAvailableRam = GetTotalAvailableRamOnNetwork( ns, "home", "home" )
      const totalMaxRam       = GetMaxRamOnNetwork( ns, "home", "home" )

      const minFreeRamFrac = Math.floor( totalMaxRam - ( totalMaxRam * 0.75 ) )
      const clampedAvailableRam = totalAvailableRam > minFreeRamFrac ? Math.floor( totalAvailableRam - minFreeRamFrac ) : 0

      const shareThreadFrac = clampedAvailableRam / totalMaxRam

      const shareThreadsToAllocate = Math.max( Math.floor( ( maxShareThreadsPossible * shareThreadFrac ) - existingShareThreads ), 0 )

      if ( shareThreadsToAllocate > 0 )
      {
        const scriptNameList = [ shareScript ]
        const scriptArgsList = [ [] ]
        const threadCountList = [ shareThreadsToAllocate ]
        DistributeScriptsToNetwork( ns, scriptNameList, scriptArgsList, threadCountList )
      }
    }
    
    if ( PIG_HUNT_DEBUG_PRINTS )
      ns.tprint( "Retrying search in " + GetReadableDateDelta( shortestHackTime ) )

    await ns.sleep( shortestHackTime )
  }  
  
}

async function ServerSearch( ns, targetServer, parentServer, accountHackPercentile, farmingScript, weakenScript, growScript, hackScript )
{
  const myHackingLevel = ns.getHackingLevel()

  const connections = ns.scan( targetServer )
  let searchedServers = Array()

  const myServers = ns.getPurchasedServers()

  //Determine how many threads we can run on home as an overflow if needed.
  const maxHomeThreadsPossible    = GetMaxThreadCountForScript( ns, farmingScript, "home" )
  const totalHomeThreadsAvailable = GetThreadCountForScript( ns, farmingScript, "home" )

  const minFreeThreadsFrac = Math.floor( maxHomeThreadsPossible - ( maxHomeThreadsPossible * HOME_SERVER_MAX_RAM_USAGE ) )
  let clampedAvailableHomeThreads = totalHomeThreadsAvailable > minFreeThreadsFrac ? Math.floor( totalHomeThreadsAvailable - minFreeThreadsFrac ) : 0

  //Get availble threads.
  const availableThreads = GetTotalAvailableThreadsForScript( ns, "home", "home", farmingScript ) + clampedAvailableHomeThreads

  //If we don't have any free threads, don't bother running a ton of logic.
  if ( availableThreads == 0 )
    return searchedServers 

  for( var i = 0; i < connections.length; i++ )
  {
    const connectionName = connections[i]
    ns.print( "connection name: " + connectionName )

    if ( connectionName == parentServer )
    {

      if ( PIG_HUNT_DEBUG_PRINTS )
        ns.tprint( "Found parent server of current server, skipping." )

      const processProgress = ( (i + 1) / connections.length ) * 100
      
      if ( PIG_HUNT_DEBUG_PRINTS )
      {
        if ( targetServer == parentServer )
          ns.tprint( "Total Search Progress Completion: " + processProgress + "%"  )
        else
          ns.tprint( targetServer + " Sub Net Search Progress Completion: " + processProgress + "%" )
      }

      continue
    }

    //Skip servers we own.
    if ( myServers.indexOf( connectionName ) != -1 )
    {
      if ( PIG_HUNT_DEBUG_PRINTS )
        ns.tprint( "Skipping a server because we own it." )

      const processProgress = ( (i + 1) / connections.length ) * 100

      if ( PIG_HUNT_DEBUG_PRINTS )
      {
        if ( targetServer == parentServer )
          ns.tprint( "Total Search Progress Completion: " + processProgress + "%"  )
        else
          ns.tprint( targetServer + " Sub Net Search Progress Completion: " + processProgress + "%" )
      }

      continue
    }

    const rootAccess = ns.hasRootAccess( connectionName )
    const serverHackingLevel = ns.getServerRequiredHackingLevel( connectionName )

    const hackingTime       = ns.getHackTime( connectionName )
    const growingTime       = ns.getGrowTime( connectionName )
    const weakeningTime     = ns.getWeakenTime( connectionName )

    if ( PIG_HUNT_DEBUG_PRINTS )
    {
      ns.tprint( "\n" )
      ns.tprint( "Evaluating server: " + connectionName + ", ETA " + GetReadableDateDelta( growingTime + weakeningTime ) + ", please wait."  )
    }
    
    const moneyAvailable    = ns.getServerMoneyAvailable( connectionName )
    const maxMoney          = ns.getServerMaxMoney( connectionName )

    if ( maxMoney == 0 ) 
    {
      if ( PIG_HUNT_DEBUG_PRINTS )
        ns.tprint( "Server cannot hold money, skipping " + connectionName )
    }
    else
    {
      if ( myHackingLevel >= serverHackingLevel && rootAccess )
      {         

        const hackPercentage    = ns.hackAnalyze( connectionName )
        const securityLevel     = ns.getServerSecurityLevel( connectionName )
        const secMinLevel       = ns.getServerMinSecurityLevel( connectionName )

        //We can run into late-game situations where our min hack percentile is larger than our target hack percentile, unless we account for this small acounts will never allocate hacking threads.
        const moneyPerHack = maxMoney * hackPercentage
        const targetHackPercentile = hackPercentage > accountHackPercentile ? hackPercentage : accountHackPercentile

        let threadsToHack = moneyPerHack > 0 ? Math.floor( maxMoney * targetHackPercentile / moneyPerHack ) : 0
        let currentActiveHackThreads = 0
        //Don't assign hacking threads if the server isn't ready to hack
        if ( securityLevel > secMinLevel || moneyAvailable < maxMoney )
        {
          threadsToHack = 0
        }
        else
        {
          if ( threadsToHack > 0 )
          {
            currentActiveHackThreads = GetTotalThreadsRunningScriptOnNetwork( ns, "home", "home", hackScript, [connectionName] ) + GetTotalThreadsRunningScriptOnHome( ns, hackScript, [connectionName] )
            threadsToHack = Math.max( 0, threadsToHack - currentActiveHackThreads )
          }
        }

        const growthThreadData   = CalculateGrowthThreads( ns, connectionName, growScript )
        const requiredWeakenThreads = CalculateWeakenThreads( ns, connectionName, weakenScript, growthThreadData.requiredThreads + growthThreadData.activeThreads, threadsToHack + currentActiveHackThreads )

        const weakenTimeMult = requiredWeakenThreads > 0 ? Math.max( 1, Math.round( requiredWeakenThreads / availableThreads ) ) : 0
        const growTimeMult   = growthThreadData.requiredThreads > 0 ? Math.max( 1, Math.round( growthThreadData.requiredThreads / availableThreads ) ) : 0

        //Assuming we have enough threads, this would be done in parallel.
        const totalWeakeningTime  = weakeningTime * weakenTimeMult
        const totalGrowingTime    = growingTime * growTimeMult

        const timeToMoneyRatio = GetTimeForEarningRatio( hackingTime + totalGrowingTime + totalWeakeningTime, maxMoney * hackPercentage )

        if ( PIG_HUNT_DEBUG_PRINTS )
          ns.tprint( connectionName + " Time to Money Ratio: " + timeToMoneyRatio )

        
          

        //THIS IS MOST LIKELY WRONG AND WE SHOULD RE-MATH IT.
        const totalThreadCount = threadsToHack + growthThreadData.requiredThreads + requiredWeakenThreads

        if ( PIG_HUNT_DEBUG_PRINTS )
          ns.tprint( "Thread Estimation for " + connectionName + ": " + totalThreadCount )
        
        //Never Return our Home computer
        if ( connectionName != "home")
        {
          if ( PIG_HUNT_DEBUG_PRINTS )
          {
            ns.tprint( "\n" )
            ns.tprint( "ADDING POTENTIAL SERVER: " + connectionName )
            ns.tprint( "\n" )
          }
          
          let serverData = new ServerData( 
          connectionName, 
          moneyAvailable,
          maxMoney,
          securityLevel,
          secMinLevel,
          serverHackingLevel,
          hackingTime,
          totalGrowingTime,
          totalWeakeningTime,
          hackPercentage,
          growthThreadData.requiredThreads,
          requiredWeakenThreads,
          threadsToHack
          )

          searchedServers.push( serverData )
        }
      }
      else
      {
        if ( PIG_HUNT_DEBUG_PRINTS )
          ns.tprint( "No root access or hacking level too high skipping " + connectionName )
      }
    }

    let branchServerSearch = await ServerSearch( ns, connectionName, targetServer, accountHackPercentile, farmingScript, weakenScript, growScript, hackScript )

    if ( branchServerSearch.length > 0 )
      searchedServers = searchedServers.concat( branchServerSearch )

    const processProgress = ( (i + 1) / connections.length ) * 100

    if ( PIG_HUNT_DEBUG_PRINTS )
    {
      if ( targetServer == parentServer )
        ns.tprint( "Total Search Progress Completion: " + processProgress + "%"  )
      else
        ns.tprint( targetServer + " Sub Net Search Progress Completion: " + processProgress + "%" )
    }    
  }

  return searchedServers
}

function GetTimeForEarningRatio( time, moneyEarned )
{
  if ( time <= 0 )
    return moneyEarned

  return moneyEarned / time
}

function CalculateGrowthThreads( ns, targetServer, growScript )
{
  const availableMoney  = ns.getServerMoneyAvailable( targetServer )
  const maxMoney        = ns.getServerMaxMoney( targetServer )
  const minMoney        = 0.1

  //const oldGrowthModel = (maxMoney - availableMoney) / minMoney

  const clampedAvailable = Math.max( availableMoney, minMoney )

  const growthMultiplier = 1 / ( 1 - ( (maxMoney - clampedAvailable) / maxMoney ) )

  if ( growthMultiplier == 0 )
    return 0  

  const growthThreads = Math.ceil( ns.growthAnalyze( targetServer, growthMultiplier ) )
  
  
  if ( growthThreads > 0 )
  {
    const currentActiveGrowThreads = GetTotalThreadsRunningScriptOnNetwork( ns, "home", "home", growScript, [targetServer] ) + GetTotalThreadsRunningScriptOnHome( ns, growScript, [targetServer] )
    const reqGrowthThreads = Math.max( 0, growthThreads - currentActiveGrowThreads )  
    
    const growthThreadData = new GrowthThreadData( reqGrowthThreads, currentActiveGrowThreads )

    return growthThreadData
  }
      
  const growthThreadData = new GrowthThreadData( growthThreads, 0 )

  return growthThreadData

}

function CalculateWeakenThreads( ns, targetServer, weakenScript, growThreadCount, hackThreadCount )
{
  const minSec = ns.getServerMinSecurityLevel( targetServer )
  const curSec = ns.getServerSecurityLevel( targetServer )
  const maxSec = ns.getServerBaseSecurityLevel( targetServer )

  //There are cases when the game starts, where a server can have a starting security value that is greater than it's max value, this covers that case.
  const highestSecurityVal = curSec > maxSec ? curSec : maxSec

  const securityPostGrow = Math.min( curSec + ( GROW_THREAD_SECURITY_DELTA * growThreadCount ), highestSecurityVal )

  const securityPostHack = Math.min( securityPostGrow + ( HACK_THREAD_SECURITY_DELTA * hackThreadCount ), highestSecurityVal )

  const securityDelta = securityPostHack - minSec

  const weakenThreads = Math.ceil( securityDelta / ns.weakenAnalyze(1,1) )

  if ( weakenThreads > 0 )
  {
    const currentActiveWeakenThreads  = GetTotalThreadsRunningScriptOnNetwork( ns, "home", "home", weakenScript, [targetServer] ) + GetTotalThreadsRunningScriptOnHome( ns, weakenScript, [targetServer] )
    const reqWeakenThreads = Math.max( 0, weakenThreads - currentActiveWeakenThreads)
    return reqWeakenThreads
  }

  return weakenThreads
}