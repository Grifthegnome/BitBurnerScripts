

//This script searches the network for low security, high-yield servers.

import { GetReadableDateDelta } from "utility.js"
import { GetTotalAvailableThreadsForScript } from "utility.js"
import { GetMaxThreadsForScript } from "utility.js"
import { GetTotalThreadsRunningScriptOnNetwork } from "utility.js"
import { GetTotalAvailableRamOnNetwork } from "utility.js"
import { GetMaxRamOnNetwork } from "utility.js"
import { DistributeScriptsToNetwork } from "utility.js"


/** @param {NS} ns */
function ServerData( name, money, maxMoney, securityLevel, secMinLevel, hackingLevel, hackingTime, 
totalGrowingTime, totalWeakeningTime, hackPercentage, requiredGrowThreads,requiredWeakenThreads, requiredHackThreads )
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

  this.hackPercentage = hackPercentage
  this.heuristic      = GetTimeForEarningRatio( this.totalTime, maxMoney * hackPercentage )
}

const PIG_HUNT_DEBUG_PRINTS = false

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

  let evaluationIncrement = ns.args[0]

  const parentServer = ns.getHostname()

  ns.print( "parent server: " + parentServer )

  while ( true )
  {
    const maxEvaluationTime = ( evaluationIncrement * 60 ) * 1000

    if ( PIG_HUNT_DEBUG_PRINTS )
    {
      ns.tprint("\n")
      ns.tprint("///////////////////////////////////////////////////////////////////////////////////")
      ns.tprint( "Starting New Search For Servers With Less Than " + GetReadableDateDelta(maxEvaluationTime) + " Eval Time." )
      ns.tprint("///////////////////////////////////////////////////////////////////////////////////")
    }
    

    let searchStartTime = new Date()

    let searchedServers = await ServerSearch( ns, parentServer, parentServer, maxEvaluationTime, farmingScript, weakenScript, growScript, hackScript )

    let searchEndTime = new Date()

    if ( PIG_HUNT_DEBUG_PRINTS )
      ns.tprint( "Server search completed after " + GetReadableDateDelta( searchEndTime.getTime() - searchStartTime.getTime() ) )

    searchedServers.sort( (a, b) => b.heuristic - a.heuristic )

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

    let totalThreadsAvailable = GetTotalAvailableThreadsForScript( ns, "home", "home", farmingScript )
    let totalThreadsAllocated = 0

    let shortestHackTime = 1000

    for ( let i = 0; i < searchedServers.length; i++  )
    {

      let sortedServer = searchedServers[ i ]

      //Skip servers with no monatary value.
      //if ( sortedServer.heuristic <= 0  )
      //  continue

      if ( sortedServer.requiredTotalThreads == 0 )
        continue

      const scriptNameList = [ weakenScript, growScript, hackScript ]
      const scriptArgsList = [ [sortedServer.name], [sortedServer.name], [sortedServer.name] ]

      const clampedGrowThreads    = sortedServer.requiredGrowThreads
      const clampodWeakenThreads  = sortedServer.requiredWeakenThreads
      const clampedHackThreads    = sortedServer.requiredHackThreads

      const threadCountList = [ clampodWeakenThreads, clampedGrowThreads, clampedHackThreads ]
    
      const totalThreadsNeeded  = clampodWeakenThreads + clampedGrowThreads + clampedHackThreads
      const threadsAllocated    = DistributeScriptsToNetwork( ns, scriptNameList, scriptArgsList, threadCountList )
        
      if ( threadsAllocated <= 0 && totalThreadsNeeded > 0 )
        break

      const hackingTime       = ns.getHackTime( sortedServer.name )
      const growingTime       = ns.getGrowTime( sortedServer.name )
      const weakeningTime     = ns.getWeakenTime( sortedServer.name )

      if ( hackingTime < shortestHackTime )
        shortestHackTime = hackingTime

      if ( growingTime < shortestHackTime )
        shortestHackTime = growingTime

      if ( weakeningTime < shortestHackTime )
        shortestHackTime = weakeningTime

      totalThreadsAllocated += threadsAllocated   
    }

    const unallocatedThreadCount = totalThreadsAvailable - totalThreadsAllocated
    
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

    //Use a binary search to hone in on best search time.
    if ( searchedServers.length == 0 )
    {
      if ( PIG_HUNT_DEBUG_PRINTS )
        ns.tprint( "No servers found, doubling search window." )

      evaluationIncrement *= 2
    }
    else if ( unallocatedThreadCount > 0 )
    {
      if ( PIG_HUNT_DEBUG_PRINTS )
        ns.tprint( "We have unused threads after targeting all valid servers, doubling search window." )
      
      evaluationIncrement *= 2
    }   

    if ( PIG_HUNT_DEBUG_PRINTS )
      ns.tprint( "Retrying search in " + GetReadableDateDelta( shortestHackTime + 1000 ) )

    await ns.sleep( shortestHackTime + 1000 )
  }  
  
}

async function ServerSearch( ns, targetServer, parentServer, maxEvaluationTime, farmingScript, 
weakenScript, growScript, hackScript )
{
  const TARGET_HACK_PERCENTAGE = 0.20

  const myHackingLevel = ns.getHackingLevel()

  const connections = ns.scan( targetServer )
  let searchedServers = Array()

  const myServers = ns.getPurchasedServers()

  //Get availble threads.
  const availableThreads = GetTotalAvailableThreadsForScript( ns, "home", "home", farmingScript )

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

    if ( growingTime + weakeningTime > maxEvaluationTime )
    {
      if ( PIG_HUNT_DEBUG_PRINTS )
        ns.tprint( GetReadableDateDelta( growingTime + weakeningTime ) + " is longer than max evaluation time of " + GetReadableDateDelta( maxEvaluationTime ) + ", skipping " + connectionName )
    }
    else if ( maxMoney == 0 ) 
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

        const requiredGrowThreads   = CalculateGrowthThreads( ns, connectionName, growScript )
        const requiredWeakenThreads = CalculateWeakenThreads( ns, connectionName, weakenScript )

        const weakenTimeMult = Math.max( 1, requiredWeakenThreads - availableThreads )
        const postWeakenThreadRemainder = Math.max( 0, availableThreads - requiredWeakenThreads )
        const growTimeMult   = Math.max( 1, requiredGrowThreads - postWeakenThreadRemainder )

        //Assuming we have enough threads, this would be done in parallel.
        const totalWeakeningTime  = weakeningTime * weakenTimeMult
        const totalGrowingTime    = growingTime * growTimeMult

        const timeToMoneyRatio = GetTimeForEarningRatio( hackingTime + totalGrowingTime + totalWeakeningTime, maxMoney * hackPercentage )

        if ( PIG_HUNT_DEBUG_PRINTS )
          ns.tprint( connectionName + " Time to Money Ratio: " + timeToMoneyRatio )

        const moneyPerHack = maxMoney * hackPercentage

        //This is a dumb estimation to hack 20% of account that doesn't account for dimishing returns.
        let threadsToHack = moneyPerHack > 0 ? Math.floor( maxMoney * TARGET_HACK_PERCENTAGE / moneyPerHack ) : 0

        //Dob't assign hacking threads if the server isn't ready to hack
        if ( securityLevel > secMinLevel || moneyAvailable < maxMoney )
        {
          threadsToHack = 0
        }
        else
        {
          if ( threadsToHack > 0 )
          {
            const currentActiveHackThreads = GetTotalThreadsRunningScriptOnNetwork( ns, "home", "home", hackScript, [connectionName] )
            threadsToHack = Math.max( 0, threadsToHack - currentActiveHackThreads )
          }
        }
          

        //THIS IS MOST LIKELY WRONG AND WE SHOULD RE-MATH IT.
        const totalThreadCount = threadsToHack + requiredGrowThreads + requiredWeakenThreads

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
          requiredGrowThreads,
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

    let branchServerSearch = await ServerSearch( ns, connectionName, targetServer, maxEvaluationTime, farmingScript, weakenScript, growScript, hackScript )

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

  const growthMultiplier = 1 / ( 1 - ( (maxMoney - availableMoney) / maxMoney ) )

  if ( growthMultiplier == 0 )
    return 0  

  const growthThreads = Math.ceil( ns.growthAnalyze( targetServer, growthMultiplier ) )
  
  
  if ( growthThreads > 0 )
  {
    const currentActiveGrowThreads = GetTotalThreadsRunningScriptOnNetwork( ns, "home", "home", growScript, [targetServer] )
    const reqGrowthThreads = Math.max( 0, growthThreads - currentActiveGrowThreads )  
    return reqGrowthThreads
  }
      
  return growthThreads

}

function CalculateWeakenThreads( ns, targetServer, weakenScript )
{
  const minSec = ns.getServerMinSecurityLevel( targetServer )
  const curSec = ns.getServerSecurityLevel( targetServer )
  //const maxSec = ns.getServerBaseSecurityLevel( targetServer )

  const securityDelta = curSec - minSec

  const weakenThreads = Math.ceil( securityDelta / ns.weakenAnalyze(1,1) )

  if ( weakenThreads > 0 )
  {
    const currentActiveWeakenThreads  = GetTotalThreadsRunningScriptOnNetwork( ns, "home", "home", weakenScript, [targetServer] )
    const reqWeakenThreads = Math.max( 0, weakenThreads - currentActiveWeakenThreads)
    return reqWeakenThreads
  }

  return weakenThreads
}