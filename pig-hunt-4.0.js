

//This script searches the network for low security, high-yield servers.

import { GetReadableDateDelta } from "utility.js"
import { GetTotalAvailableThreadsForScript } from "utility.js"
import { UnpauseScriptsOnServer } from "utility.js"
import { PauseAllServersTargetingGivenServer } from "utility.js"
import { DistributeScriptsToNetwork } from "utility.js"
import { KillAllNetworkProcesses } from "utility.js"

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
  const cultivateScript = "server-cultivate.js"

  const hackScriptRam       = ns.getScriptRam( hackScript )
  const cultivateScriptRam  = ns.getScriptRam( cultivateScript )

  //For now assign the farming script for the search to be the script with the highest ram cost.
  let farmingScript = hackScript
  if ( cultivateScriptRam > hackScriptRam )
    farmingScript = cultivateScript

  let evaluationIncrement = ns.args[0]

  const parentServer = ns.getHostname()

  ns.print( "parent server: " + parentServer )

  while ( true )
  {
    const maxEvaluationTime = ( evaluationIncrement * 60 ) * 1000

    ns.tprint("\n")
    ns.tprint("///////////////////////////////////////////////////////////////////////////////////")
    ns.tprint( "Starting New Search For Servers With Less Than " + GetReadableDateDelta(maxEvaluationTime) + " Eval Time." )
    ns.tprint("///////////////////////////////////////////////////////////////////////////////////")

    let searchStartTime = new Date()

    let searchedServers = await ServerSearch( ns, parentServer, parentServer, maxEvaluationTime, farmingScript )

    let searchEndTime = new Date()

    ns.tprint( "Server search completed after " + GetReadableDateDelta( searchEndTime.getTime() - searchStartTime.getTime() ) )

    searchedServers.sort( (a, b) => b.heuristic - a.heuristic )

    if ( searchedServers.length > 0 )
    {
      KillAllNetworkProcesses( ns, "home", "home" )
    }

    let totalRequiredThreads = 0;
    for ( let i = 0; i < searchedServers.length; i++ )
    {
      let sortedServer = searchedServers[ i ]
      totalRequiredThreads += sortedServer.requiredTotalThreads 
    }

    let totalThreadsAvailable = GetTotalAvailableThreadsForScript( ns, "home", "home", farmingScript )
    let totalThreadsAllocated = 0

    let longestHackTime = 1000

  debugger

    for ( let i = 0; i < searchedServers.length; i++  )
    {

      let sortedServer = searchedServers[ i ]

      //Skip servers with no monatary value.
      //if ( sortedServer.heuristic <= 0  )
      //  continue

      if ( sortedServer.requiredTotalThreads == 0 )
        continue

      const scriptNameList = [ cultivateScript, hackScript ]
      const scriptArgsList = [ [sortedServer.name], [sortedServer.name] ]

    
      const clampedGrowThreads    = sortedServer.requiredGrowThreads
      const clampodWeakenThreads = sortedServer.requiredWeakenThreads
      
      const clampedCultivateThreads = clampodWeakenThreads + clampedGrowThreads
      const clampedHackThreads = sortedServer.requiredHackThreads

      debugger

      const threadCountList = [ clampedCultivateThreads, clampedHackThreads ]
        
      const threadsAllocated = DistributeScriptsToNetwork( ns, scriptNameList, scriptArgsList, threadCountList )
        
      if ( threadsAllocated <= 0 )
        break

      const hackingTime       = ns.getHackTime( sortedServer.name )
      const growingTime       = ns.getGrowTime( sortedServer.name )
      const weakeningTime     = ns.getWeakenTime( sortedServer.name )

      if ( hackingTime > longestHackTime )
        longestHackTime = hackingTime

      if ( growingTime > longestHackTime )
        longestHackTime = growingTime

      if ( weakeningTime > longestHackTime )
        longestHackTime = weakeningTime

      totalThreadsAllocated += threadsAllocated   
    }

    const unallocatedThreadCount = totalThreadsAvailable - totalThreadsAllocated

    //Use a binary search to hone in on best search time.
    if ( searchedServers.length == 0 )
    {
      ns.tprint( "No servers found, doubling search window." )
      evaluationIncrement *= 2
    }
    else if ( unallocatedThreadCount > 0 )
    {
      ns.tprint( "We have unused threads after targeting all valid servers, doubling search window." )
      evaluationIncrement *= 2
    }   

    ns.tprint( "Retrying search in " + GetReadableDateDelta( longestHackTime + 1000 ) )

    await ns.sleep( longestHackTime + 1000 )
  }  
  
}

async function ServerSearch( ns, targetServer, parentServer, maxEvaluationTime, farmingScript )
{
  const myHackingLevel = ns.getHackingLevel()

  const connections = ns.scan( targetServer )
  let searchedServers = Array()

  const myServers = ns.getPurchasedServers()

  for( var i = 0; i < connections.length; i++ )
  {
    const connectionName = connections[i]
    ns.print( "connection name: " + connectionName )

    if ( connectionName == "CSEC")
      debugger

    if ( connectionName == parentServer )
    {
      ns.tprint( "Found parent server of current server, skipping." )

      const processProgress = ( (i + 1) / connections.length ) * 100
      
      if ( targetServer == parentServer )
        ns.tprint( "Total Search Progress Completion: " + processProgress + "%"  )
      else
        ns.tprint( targetServer + " Sub Net Search Progress Completion: " + processProgress + "%" )

      continue
    }

    //Skip servers we own.
    if ( myServers.indexOf( connectionName ) != -1 )
    {
      ns.tprint( "Skipping a server because we own it." )

      const processProgress = ( (i + 1) / connections.length ) * 100

      if ( targetServer == parentServer )
        ns.tprint( "Total Search Progress Completion: " + processProgress + "%"  )
      else
        ns.tprint( targetServer + " Sub Net Search Progress Completion: " + processProgress + "%" )

      continue
    }

    const rootAccess = ns.hasRootAccess( connectionName )
    const serverHackingLevel = ns.getServerRequiredHackingLevel( connectionName )

    const hackingTime       = ns.getHackTime( connectionName )
    const growingTime       = ns.getGrowTime( connectionName )
    const weakeningTime     = ns.getWeakenTime( connectionName )

    ns.tprint( "\n" )
    ns.tprint( "Evaluating server: " + connectionName + ", ETA " + GetReadableDateDelta( growingTime + weakeningTime ) + ", please wait."  )

    const moneyAvailable    = ns.getServerMoneyAvailable( connectionName )
    const maxMoney          = ns.getServerMaxMoney( connectionName )

    if ( growingTime + weakeningTime > maxEvaluationTime )
    {
      ns.tprint( GetReadableDateDelta( growingTime + weakeningTime ) + " is longer than max evaluation time of " + GetReadableDateDelta( maxEvaluationTime ) + ", skipping " + connectionName )
    }
    else if ( maxMoney == 0 ) 
    {
        ns.tprint( "Server cannot hold money, skipping " + connectionName )
    }
    else
    {
      if ( myHackingLevel >= serverHackingLevel && rootAccess )
      {     

        //Get availble threads to see if it has changed mid-process.
        const availableThreads = GetTotalAvailableThreadsForScript( ns, "home", "home", farmingScript )
         
        const hackPercentage    = ns.hackAnalyze( connectionName )
        const securityLevel     = ns.getServerSecurityLevel( connectionName )
        const secMinLevel       = ns.getServerMinSecurityLevel( connectionName )

        const requiredGrowThreads = CalculateGrowthThreads( ns, connectionName )
        const requiredWeakenThreads = CalculateWeakenThreads( ns, connectionName )

        const totalGrowingTime    = growingTime * requiredGrowThreads
        const totalWeakeningTime  = weakeningTime * requiredWeakenThreads

        const timeToMoneyRatio = GetTimeForEarningRatio( hackingTime + totalGrowingTime + totalWeakeningTime, maxMoney * hackPercentage )

        ns.tprint( connectionName + " Time to Money Ratio: " + timeToMoneyRatio )

        const moneyPerHack = maxMoney * hackPercentage

        //This is a dumb estimation that doesn't account for dimishing returns.
        const threadsToHack = moneyPerHack > 0 ? Math.floor( maxMoney / moneyPerHack ) : 0

        //THIS IS MOST LIKELY WRONG AND WE SHOULD RE-MATH IT.
        const totalThreadCount = threadsToHack + requiredGrowThreads + requiredWeakenThreads

        ns.tprint( "Thread Estimation for " + connectionName + ": " + totalThreadCount )
        
        //Never Return our Home computer
        if ( connectionName != "home")
        {
          ns.tprint( "\n" )
          ns.tprint( "ADDING POTENTIAL SERVER: " + connectionName )
          ns.tprint( "\n" )
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
        ns.tprint( "No root access or hacking level too high skipping " + connectionName )
      }
    }

    debugger

    let branchServerSearch = await ServerSearch( ns, connectionName, targetServer, maxEvaluationTime, farmingScript )

    if ( branchServerSearch.length > 0 )
      searchedServers = searchedServers.concat( branchServerSearch )

    const processProgress = ( (i + 1) / connections.length ) * 100

    if ( targetServer == parentServer )
      ns.tprint( "Total Search Progress Completion: " + processProgress + "%"  )
    else
      ns.tprint( targetServer + " Sub Net Search Progress Completion: " + processProgress + "%" )

  }

  return searchedServers
}

function GetTimeForEarningRatio( time, moneyEarned )
{
  if ( time <= 0 )
    return moneyEarned

  return moneyEarned / time
}

function CalculateGrowthThreads( ns, targetServer )
{
  const availableMoney  = ns.getServerMoneyAvailable( targetServer )
  const maxMoney        = ns.getServerMaxMoney( targetServer )
  const minMoney        = 0.1

  const growthMultiplier = (maxMoney - availableMoney) / minMoney
  //const growthMultiplier = maxMoney / minMoney

  if ( growthMultiplier == 0 )
    return 0  

  const growthThreads = Math.ceil( ns.growthAnalyze( targetServer, growthMultiplier ) )

  return growthThreads

}

function CalculateWeakenThreads( ns, targetServer )
{
  const minSec = ns.getServerMinSecurityLevel( targetServer )
  //const curSec = ns.getServerSecurityLevel( targetServer )
  const maxSec = ns.getServerBaseSecurityLevel( targetServer )

  const securityDelta = maxSec - minSec

  const reqWeakenThreads = Math.ceil( securityDelta / ns.weakenAnalyze(1,1) )

  return reqWeakenThreads
}