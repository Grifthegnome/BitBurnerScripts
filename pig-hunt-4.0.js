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

import { SetActiveRamPreallocationKeys } from "utility.js"
import { ClearActiveRamPreallocationKeys } from "utility.js" 
import { GetPreallocateRamForActiveKeysOnNetwork } from "utility.js"
import { PreallocateRamForKeyOnNetwork } from "utility.js"
import { ReleaseAllPreallocatedServerRamForKey } from "utility.js"

const REQUIRED_THREADS_FILENAME = "unused_thread_report.txt"
const COMPROMISED_SERVER_FILENAME = "servers_compromised.txt"

/** @param {NS} ns */
function ServerData( name, money, maxMoney, securityLevel, secMinLevel, hackingLevel, hackingTime, 
totalGrowingTime, totalWeakeningTime, hackPercentage, requiredGrowThreads, requiredWeakenThreads, requiredHackThreads, activeGrowThreads, activeWeakenThreads, activeHackThreads )
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

  this.activeGrowThreads      = activeGrowThreads
  this.activeWeakenThreads    = activeWeakenThreads
  this.activeHackThreads      = activeHackThreads
  this.activeTotalThreads     = activeGrowThreads + activeWeakenThreads + activeHackThreads

  this.totalTime              = hackingTime + totalGrowingTime + totalWeakeningTime

  const longestProcessTime = this.totalGrowingTime > this.totalWeakeningTime ? this.totalGrowingTime : this.totalWeakeningTime
  this.totalTimeDevReadable   = this.requiredHackThreads > 0 ? "Finished Hacking In: " + GetReadableDateDelta( this.hackingTime ) : "Can Hack In: " + GetReadableDateDelta( longestProcessTime )

  this.hackPercentage = hackPercentage

  this.heuristic = this.requiredHackThreads > 0 ? this.hackingTime : ( longestProcessTime ) * 1000 //GetTimeForEarningRatio( this.totalTime, maxMoney * hackPercentage )

  //this.heuristic = this.requiredHackThreads > 0 ? -this.requiredTotalThreads : this.requiredTotalThreads
}

function ProcessThreadData( requiredThreads, activeThreads )
{
  this.requiredThreads = requiredThreads
  this.activeThreads = activeThreads
}

const PIG_HUNT_DEBUG_PRINTS = false
const ACCOUNT_HACK_ADJUSTMENT_PERCENTILE = 0.01
const ACCOUNT_HACK_PERCENTILE = 0.2

//The max percentage of ram threads allocated by this script can use on our home server, we always want head room to run other scripts.
const HOME_SERVER_MAX_RAM_USAGE = 0.75

const PIG_HUNT_RAM_ALLOCATION_KEY = "ph_compromised_alloc"

export async function main(ns) 
{

  let compromisedServers = {}

  if ( ns.fileExists( COMPROMISED_SERVER_FILENAME, "home" ) )
  {
    const jsonStringRead = ns.read( COMPROMISED_SERVER_FILENAME )
    compromisedServers = JSON.parse( jsonStringRead )
  }

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

  const hackScriptRam       = ns.getScriptRam( hackScript, "home" )
  const weakenScriptRam     = ns.getScriptRam( weakenScript, "home" )
  const growScriptRam       = ns.getScriptRam( growScript, "home" )
  const shareScriptRam      = ns.getScriptRam( shareScript, "home" )

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

    //let serverSearchTime = new Date()

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

    let totalRequiredThreads = 0;
    for ( let i = 0; i < searchedServers.length; i++ )
    {
      let sortedServer = searchedServers[ i ]
      totalRequiredThreads += sortedServer.requiredTotalThreads 
    }

    //ACTIVATE PIG_HUNT_RAM_ALLOCATION_KEY 
    SetActiveRamPreallocationKeys( ns, [PIG_HUNT_RAM_ALLOCATION_KEY] )

    //Determine how many threads we can run on home as an overflow if needed.
    const maxHomeThreadsPossible    = GetMaxThreadCountForScript( ns, farmingScript, "home" )
    const totalHomeThreadsAvailable = GetThreadCountForScript( ns, farmingScript, "home" )

    const minFreeThreadsFrac = Math.floor( maxHomeThreadsPossible - ( maxHomeThreadsPossible * HOME_SERVER_MAX_RAM_USAGE ) )
    let clampedAvailableHomeThreads = totalHomeThreadsAvailable > minFreeThreadsFrac ? Math.floor( totalHomeThreadsAvailable - minFreeThreadsFrac ) : 0

    const maxNetworkThreadsPossible = GetMaxThreadsForScript( ns, "home", "home", farmingScript )
    let totalNetworkThreadsAvailable = GetTotalAvailableThreadsForScript( ns, "home", "home", farmingScript )
    let totalNetworkThreadsAllocated = 0

    const compromisedServerFarmUsageFrac = GetTotalFarmUsageForCompromisedServers( compromisedServers )
    const targetPreallocThreads = Math.ceil(maxNetworkThreadsPossible * compromisedServerFarmUsageFrac)
    const targetPreallocRam     = Math.ceil(targetPreallocThreads * highestRamCost)

    const preallocatedRamOnNetwork = GetPreallocateRamForActiveKeysOnNetwork( ns, "home", "home" )
    
    //CLEAR PIG_HUNT_RAM_ALLOCATION_KEY
    ClearActiveRamPreallocationKeys( ns )

    if ( targetPreallocRam != preallocatedRamOnNetwork )
    {
      ReleaseAllPreallocatedServerRamForKey( ns, PIG_HUNT_RAM_ALLOCATION_KEY )
      PreallocateRamForKeyOnNetwork( ns, targetPreallocRam, PIG_HUNT_RAM_ALLOCATION_KEY )
    }

    let shortestHackTime = 1000

    for ( let i = 0; i < searchedServers.length; i++  )
    {

      const remainingNetworkThreadsAvailable = totalNetworkThreadsAvailable - totalNetworkThreadsAllocated

      if ( remainingNetworkThreadsAvailable <= 0 && clampedAvailableHomeThreads <= 0 )
        break 

      let sortedServer = searchedServers[ i ]

      //Skip servers with no monatary value.
      //if ( sortedServer.heuristic <= 0  )
      //  continue

      if ( sortedServer.requiredTotalThreads == 0 && !(sortedServer.name  in compromisedServers) )
      {
        compromisedServers[sortedServer.name] = (sortedServer.requiredTotalThreads + sortedServer.activeTotalThreads) / maxNetworkThreadsPossible 
        const jsonStringWrite = JSON.stringify( compromisedServers )
        await ns.write( COMPROMISED_SERVER_FILENAME, jsonStringWrite, "w" )
      }
      else if ( (sortedServer.name  in compromisedServers) && sortedServer.requiredHackThreads > 0 ) 
      {
        compromisedServers[sortedServer.name] = (sortedServer.requiredTotalThreads + sortedServer.activeTotalThreads) / maxNetworkThreadsPossible 
        const jsonStringWrite = JSON.stringify( compromisedServers )
        await ns.write( COMPROMISED_SERVER_FILENAME, jsonStringWrite, "w" )
      }

      if ( sortedServer.requiredTotalThreads == 0 )
        continue

      const hackingTime       = ns.getHackTime( sortedServer.name )
      const growingTime       = ns.getGrowTime( sortedServer.name )
      const weakeningTime     = ns.getWeakenTime( sortedServer.name )

      const hackingThreadDelay = 0
      const growThreadDelay = growingTime > weakeningTime ? growingTime - weakeningTime : 0
      const weakeningThreadDelay = hackingTime > weakeningTime ? hackingTime - weakeningTime : 0

      const scriptNameList = [ growScript, weakenScript, hackScript ]
      const scriptArgsList = [ [sortedServer.name, growThreadDelay], [sortedServer.name, weakeningThreadDelay], [sortedServer.name, hackingThreadDelay] ]

      let clampedGrowThreads    = sortedServer.requiredGrowThreads
      let clampedWeakenThreads  = sortedServer.requiredWeakenThreads
      let clampedHackThreads    = sortedServer.requiredHackThreads

      //TO DO: Grow and Weaken are more efficient on home server with more cores.
      //Home should prioritize grow and weaken of new, uncompromised servers, and server farm should handle hacks.

      //Ensure max strength hack.
      if ( maxNetworkThreadsPossible < clampedHackThreads + clampedWeakenThreads && clampedHackThreads > 0 )
      {
        //we only want to hack when we can hack at full thread power, or we are using all our current resources to the best hack we can.
        if ( maxNetworkThreadsPossible > remainingNetworkThreadsAvailable )
        {

          //If we can run the threads on our home server to unblock our server farm, do it.
          if ( clampedAvailableHomeThreads >= clampedHackThreads + clampedWeakenThreads && clampedHackThreads > 0 )
          {
            const homeScriptNameList = [ hackScript, weakenScript ]
            const homeScriptArgsList = [ [sortedServer.name, hackingThreadDelay], [sortedServer.name, weakeningThreadDelay] ]
            const homeThreadCountList = [ clampedHackThreads, clampedWeakenThreads ]

            //ns.tprint( serverSearchTime.getTime() + "Home Machine PRIORITY: Starting " + ( clampedHackThreads + clampedWeakenThreads ) + " thread of " + sortedServer.requiredTotalThreads + " hack on " + sortedServer.name )

            clampedAvailableHomeThreads -= DistribueScriptsToHome( ns, homeScriptNameList, homeScriptArgsList, homeThreadCountList )
            continue
          }
          else
          {
            //ns.tprint( serverSearchTime.getTime() + sortedServer.name + " is ready to hack, skipping due to lack of max threads needed." )
            //Skip this server until we have enough maximum threads to do a full-power hack.
            continue
          }
        }
      }
      else
      {
        if ( remainingNetworkThreadsAvailable < clampedHackThreads + clampedWeakenThreads && clampedHackThreads > 0 )
        {
          //If we can run the threads on our home server to unblock our server farm, do it.
          if ( clampedAvailableHomeThreads >= clampedHackThreads + clampedWeakenThreads && clampedHackThreads > 0 )
          {
            const homeScriptNameList = [ hackScript, weakenScript ]
            const homeScriptArgsList = [ [sortedServer.name, hackingThreadDelay], [sortedServer.name, weakeningThreadDelay] ]
            const homeThreadCountList = [ clampedHackThreads, clampedWeakenThreads ]

             //ns.tprint( serverSearchTime.getTime() + "Home Machine PRIORITY: Starting " + ( clampedHackThreads + clampedWeakenThreads ) + " thread of " + sortedServer.requiredTotalThreads + " hack on " + sortedServer.name )

            clampedAvailableHomeThreads -= DistribueScriptsToHome( ns, homeScriptNameList, homeScriptArgsList, homeThreadCountList )
            continue
          }
          else
          {
            //ns.tprint( serverSearchTime.getTime() + sortedServer.name + " is ready to hack, delaying due to lack of threads." )
            //Skip all lower priorty servers till we can hack this one.
            totalNetworkThreadsAllocated = totalNetworkThreadsAvailable
            break
          }
        }
      }          

      let maxTimeUntilThreadFinished = 0
      if ( clampedGrowThreads > 0 )
        maxTimeUntilThreadFinished = growingTime 
        
      if ( clampedWeakenThreads > 0 )
      {
        if ( weakeningTime > maxTimeUntilThreadFinished )
          maxTimeUntilThreadFinished = weakeningTime
      }
        
      //We use this value to scale the maximum process time we allow to run on our home server based on how much free ram we have available.
      //const clampedAvailableHomeRamUseFrac = Math.min( sortedServer.requiredTotalThreads / clampedAvailableHomeThreads, 1.0 )

      if ( clampedAvailableHomeThreads > 0 && ( !(sortedServer.name in compromisedServers) || Object.keys(compromisedServers).length == searchedServers.length ) )
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

        //if ( homeClampedHackThreads > 0 )
        //  ns.tprint( serverSearchTime.getTime() + "Home Machine: Starting " + ( homeClampedHackThreads + homeClampedWeakenThreads ) + " thread of " + sortedServer.requiredTotalThreads +  " hack on " + sortedServer.name )

        const threadCountList = [ homeClampedGrowThreads, homeClampedWeakenThreads, homeClampedHackThreads ]
        const totalHomeThreadsAllocated = DistribueScriptsToHome( ns, scriptNameList, scriptArgsList, threadCountList )
        
        if ( homeClampedGrowThreads + homeClampedWeakenThreads + homeClampedHackThreads != totalHomeThreadsAllocated )
          debugger

        clampedGrowThreads    -= homeClampedGrowThreads
        clampedWeakenThreads  -= homeClampedWeakenThreads
        clampedHackThreads    -= homeClampedHackThreads
        sortedServer.requiredTotalThreads -= totalHomeThreadsAllocated

        clampedAvailableHomeThreads -= totalHomeThreadsAllocated

        if ( !threadAllocationClampedOnHome )
          continue
      }

      if ( remainingNetworkThreadsAvailable <= 0 )
        continue 

      //Don't allow us to continue if we can't run a full hack.
      if ( remainingNetworkThreadsAvailable < clampedHackThreads + clampedWeakenThreads && clampedHackThreads > 0 )
        continue
      
      //If we don't have enough threads, we want to scale down our thread requirements by a uniform scalar so that we still run some of each of our required threads.
      if ( sortedServer.requiredTotalThreads > remainingNetworkThreadsAvailable )
      {
        const threadsNeededScalar = remainingNetworkThreadsAvailable / sortedServer.requiredTotalThreads
        clampedGrowThreads    = Math.round( clampedGrowThreads * threadsNeededScalar )
        clampedWeakenThreads  = Math.round( clampedWeakenThreads * threadsNeededScalar )
        clampedHackThreads    = Math.round( clampedHackThreads * threadsNeededScalar )

        const postScaleTotalThreadsNeeded  = clampedWeakenThreads + clampedGrowThreads + clampedHackThreads

        if ( postScaleTotalThreadsNeeded > remainingNetworkThreadsAvailable )
          debugger
      } 

      const threadCountList = [ clampedGrowThreads, clampedWeakenThreads, clampedHackThreads ]
    
      //if ( clampedHackThreads )
      //  ns.tprint( serverSearchTime.getTime() + "Main Farm: Starting " + ( clampedHackThreads + clampedWeakenThreads ) + " thread of " + sortedServer.requiredTotalThreads +  " hack on " + sortedServer.name )

      //We only want compromised servers to use preallocated server farm ram.
      const allocationKey = sortedServer.name in compromisedServers ? [PIG_HUNT_RAM_ALLOCATION_KEY] : []
      const threadsAllocated    = DistributeScriptsToNetwork( ns, scriptNameList, scriptArgsList, threadCountList, allocationKey )
        
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

    //If we have compromised all current servers and have remaining threads, we have unallocated threads.
    const unallocatedThreadCount = Object.keys(compromisedServers).length == searchedServers.length ? totalNetworkThreadsAvailable - totalNetworkThreadsAllocated : 0
    
    const jsonStringWrite = JSON.stringify( unallocatedThreadCount )
    await ns.write( REQUIRED_THREADS_FILENAME, jsonStringWrite, "w" )

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
        DistributeScriptsToNetwork( ns, scriptNameList, scriptArgsList, threadCountList, [PIG_HUNT_RAM_ALLOCATION_KEY] )
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

  //ACTIVATE PIG_HUNT_RAM_ALLOCATION_KEY 
  SetActiveRamPreallocationKeys( ns, [PIG_HUNT_RAM_ALLOCATION_KEY] )

  //Determine how many threads we can run on home as an overflow if needed.
  const maxHomeThreadsPossible    = GetMaxThreadCountForScript( ns, farmingScript, "home" )
  const totalHomeThreadsAvailable = GetThreadCountForScript( ns, farmingScript, "home" )

  const minFreeThreadsFrac = Math.floor( maxHomeThreadsPossible - ( maxHomeThreadsPossible * HOME_SERVER_MAX_RAM_USAGE ) )
  let clampedAvailableHomeThreads = totalHomeThreadsAvailable > minFreeThreadsFrac ? Math.floor( totalHomeThreadsAvailable - minFreeThreadsFrac ) : 0

  //Get availble threads.
  const availableThreads = GetTotalAvailableThreadsForScript( ns, "home", "home", farmingScript ) + clampedAvailableHomeThreads

  //CLEAR PIG_HUNT_RAM_ALLOCATION_KEY
  ClearActiveRamPreallocationKeys( ns )

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

        let threadsToHack = moneyPerHack > 0 ? Math.floor( maxMoney * ( targetHackPercentile / moneyPerHack ) ) : 0
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

        const growthThreadData = CalculateGrowthThreads( ns, connectionName, growScript )
        const weakenThreadData = CalculateWeakenThreads( ns, connectionName, weakenScript, growthThreadData.requiredThreads + growthThreadData.activeThreads, threadsToHack + currentActiveHackThreads )

        let availableGrowthThreadScalar = 1.0
        let availableWeakenThreadScalar = 1.0
        if ( weakenThreadData.requiredThreads > growthThreadData.requiredThreads )
        {
          availableGrowthThreadScalar = growthThreadData.requiredThreads / weakenThreadData.requiredThreads
          availableWeakenThreadScalar = Math.max( 1.0 - availableGrowthThreadScalar, 0 )
        }
        else if ( growthThreadData.requiredThreads > weakenThreadData.requiredThreads )
        {
          availableWeakenThreadScalar = weakenThreadData.requiredThreads / growthThreadData.requiredThreads
          availableGrowthThreadScalar = Math.max( 1.0 - availableWeakenThreadScalar, 0 )
        }

        const weakenTimeMult = weakenThreadData.requiredThreads > 0 ? Math.max( 1, Math.round( weakenThreadData.requiredThreads / ( availableThreads * availableWeakenThreadScalar ) ) ) : 0
        const growTimeMult   = growthThreadData.requiredThreads > 0 ? Math.max( 1, Math.round( growthThreadData.requiredThreads / ( availableThreads * availableGrowthThreadScalar ) ) ) : 0

        //Assuming we have enough threads, this would be done in parallel.
        const totalWeakeningTime  = currentActiveHackThreads > 0 ? 0 : weakeningTime * weakenTimeMult
        const totalGrowingTime    = growingTime * growTimeMult

        const timeToMoneyRatio = GetTimeForEarningRatio( hackingTime + totalGrowingTime + totalWeakeningTime, maxMoney * hackPercentage )

        if ( PIG_HUNT_DEBUG_PRINTS )
          ns.tprint( connectionName + " Time to Money Ratio: " + timeToMoneyRatio )

        
          

        //THIS IS MOST LIKELY WRONG AND WE SHOULD RE-MATH IT.
        const totalThreadCount = threadsToHack + growthThreadData.requiredThreads + weakenThreadData.requiredThreads

        if ( PIG_HUNT_DEBUG_PRINTS )
          ns.tprint( "Thread Estimation for " + connectionName + ": " + totalThreadCount )
        
        //let needsThreads = growthThreadData.requiredThreads > 0 || requiredWeakenThreads > 0 || threadsToHack > 0

        //Never Return our Home computer
        if ( connectionName != "home" )
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
          weakenThreadData.requiredThreads,
          threadsToHack,
          growthThreadData.activeThreads,
          weakenThreadData.activeThreads,
          currentActiveHackThreads          
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
  const minMoney        = 1 //Every growth thread adds one dollar before multiplying.

  //const oldGrowthModel = (maxMoney - availableMoney) / minMoney

  const growthParameter = ns.getServerGrowth(targetServer)
  //ns.growthAnalyzeSecurity() 

  const clampedAvailable = Math.max( availableMoney, minMoney )

  const growthMultiplier = 1 / ( 1 - ( (maxMoney - clampedAvailable) / maxMoney ) )

  if ( growthMultiplier == 0 )
    return 0  

  //This is a pure exponential calculation, every thread also adds 1$ before multiplying.
  const growthThreads = Math.ceil( ns.growthAnalyze( targetServer, growthMultiplier ) )
  
  
  if ( growthThreads > 0 )
  {
    const currentActiveGrowThreads = GetTotalThreadsRunningScriptOnNetwork( ns, "home", "home", growScript, [targetServer] ) + GetTotalThreadsRunningScriptOnHome( ns, growScript, [targetServer] )
    const reqGrowthThreads = Math.max( 0, growthThreads - currentActiveGrowThreads )  
    
    const growthThreadData = new ProcessThreadData( reqGrowthThreads, currentActiveGrowThreads )

    return growthThreadData
  }
      
  const growthThreadData = new ProcessThreadData( growthThreads, 0 )

  return growthThreadData

}

function CalculateWeakenThreads( ns, targetServer, weakenScript, growThreadCount, hackThreadCount )
{
  const minSec = ns.getServerMinSecurityLevel( targetServer )
  const curSec = ns.getServerSecurityLevel( targetServer )
  const maxSec = ns.getServerBaseSecurityLevel( targetServer )

  //There are cases when the game starts, where a server can have a starting security value that is greater than it's max value, this covers that case.
  const highestSecurityVal = curSec > maxSec ? curSec : maxSec

  const securityPostGrow = Math.min( curSec + ns.growthAnalyzeSecurity(growThreadCount, targetServer, 1) , highestSecurityVal )
  const securityPostHack = Math.min( securityPostGrow + ns.hackAnalyzeSecurity( hackThreadCount, targetServer ), highestSecurityVal )

  const securityDelta = securityPostHack - minSec

  const weakenThreads = Math.ceil( securityDelta / ns.weakenAnalyze(1,1) )

  if ( weakenThreads > 0 )
  {
    const currentActiveWeakenThreads  = GetTotalThreadsRunningScriptOnNetwork( ns, "home", "home", weakenScript, [targetServer] ) + GetTotalThreadsRunningScriptOnHome( ns, weakenScript, [targetServer] )
    const reqWeakenThreads = Math.max( 0, weakenThreads - currentActiveWeakenThreads)
    
    const weakenThreadData = new ProcessThreadData( reqWeakenThreads, currentActiveWeakenThreads )
    return weakenThreadData
  }

  const weakenThreadData = new ProcessThreadData( weakenThreads, 0 )

  return weakenThreadData
}

function GetTotalFarmUsageForCompromisedServers( compromisedServers )
{
  const serverNames = Object.keys( compromisedServers )

  let totalUsageFrac = 0

  for ( let i = 0; i < serverNames.length; i++ )
  {
    const serverName = serverNames[ i ]
    const farmUsageFrac = compromisedServers[ serverName ]
    totalUsageFrac += farmUsageFrac
  }

  if ( totalUsageFrac > 1 )
    totalUsageFrac = 1

  return totalUsageFrac
}