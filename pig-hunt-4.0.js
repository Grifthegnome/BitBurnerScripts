

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

function GrowCallProfileData( growCallCount, growSecurityDeltaPercentage )
{
  this.growCallCount                = growCallCount
  this.growSecurityDeltaPercentage  = growSecurityDeltaPercentage
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
  const hackScript    = "server-hack.js"
  const growScript    = "server-grow.js"
  const weakenScript  = "server-weaken.js"

  const hackScriptRam = ns.getScriptRam( hackScript )
  const growScriptRam = ns.getScriptRam( growScript )
  const weakScriptRam = ns.getScriptRam( weakenScript )

  //For now assign the farming script for the search to be the script with the highest ram cost.
  let farmingScript = hackScript
  if ( growScriptRam > hackScriptRam )
    farmingScript = growScript
  else if ( weakScriptRam > hackScriptRam && weakScriptRam > growScriptRam )
    farmingScript = weakenScript


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

    //Get total available threads for script at the time search finishes.
    //This allows us to include any new servers and memory upgrades in our final script deployment.
    let availableThreads = GetTotalAvailableThreadsForScript( ns, "home", "home", farmingScript )

    let totalRequiredThreads = 0;
    for ( let i = 0; i < searchedServers.length; i++ )
    {
      let sortedServer = searchedServers[ i ]
      totalRequiredThreads += sortedServer.requiredTotalThreads 
    }

    const threadRequirementDelta = availableThreads - totalRequiredThreads

    for ( let i = 0; i < searchedServers.length; i++  )
    {

      if ( availableThreads <= 0  )
        break

      let sortedServer = searchedServers[ i ]

      //Skip servers with no monatary value.
      if ( sortedServer.heuristic <= 0  )
        continue

      const scriptNameList = [ growScript, weakenScript, hackScript ]
      const scriptArgsList = [ [sortedServer.name], [sortedServer.name], [sortedServer.name] ]

      if ( sortedServer.requiredTotalThreads > availableThreads )
      {
        const clampedGrowThreads = Math.max( 0, availableThreads -= sortedServer.requiredGrowThreads )
        const clampodWeakenThreads = Math.max( 0, availableThreads -= sortedServer.requiredWeakenThreads )
        const clampedHackThreads = Math.max( 0, availableThreads -= sortedServer.requiredHackThreads )

        const threadCountList = [ clampedGrowThreads, clampodWeakenThreads, clampedHackThreads ]
        DistributeScriptsToNetwork( ns, scriptNameList, scriptArgsList, threadCountList )
      }
      else
      {
        const threadCountList = [ sortedServer.requiredGrowThreads, sortedServer.requiredWeakenThreads, sortedServer.requiredHackThreads ]
        DistributeScriptsToNetwork( ns, scriptNameList, scriptArgsList, threadCountList )
      }
      
      availableThreads -= sortedServer.requiredTotalThreads      
    }

    //Use a binary search to hone in on best search time.
    if ( threadRequirementDelta > 0 )
    {
      ns.tprint( "We have unused threads after targeting all valid servers, doubling search window." )
      evaluationIncrement *= 2
    }
    else if ( threadRequirementDelta < 0 )
    {
      ns.tprint( "Threads required to hack all return servers is higher than what we have available, shrinking search window." )
      evaluationIncrement *= 0.75
    }     

    await ns.sleep( 20000 )
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

    if ( growingTime + weakeningTime > maxEvaluationTime )
    {
      ns.tprint( GetReadableDateDelta( growingTime + weakeningTime ) + " is longer than max evaluation time of " + GetReadableDateDelta( maxEvaluationTime ) + ", skipping " + connectionName )
    }
    else
    {
      if ( myHackingLevel >= serverHackingLevel && rootAccess )
      {     

        //Get availble threads to see if it has changed mid-process.
        const availableThreads = GetTotalAvailableThreadsForScript( ns, "home", "home", farmingScript )

        const moneyAvailable    = ns.getServerMoneyAvailable( connectionName )
        const maxMoney          = ns.getServerMaxMoney( connectionName )

        const securityLevel     = ns.getServerSecurityLevel( connectionName )
        const secMinLevel       = ns.getServerMinSecurityLevel( connectionName )

        const hackPercentage    = ns.hackAnalyze( connectionName )
        
        const startTime = new Date()

        //We have to halt all processing on the server so hacking doesn't mess up our measurements.
        let pauseData = PauseAllServersTargetingGivenServer( ns, "home", "home", connectionName )

        const growProfile           = await CalculateGrowProfile( ns, connectionName )
        const postGrowThreadCount   = Math.max( 1, availableThreads - growProfile.growCallCount )
        const threadedGrowCallCount = Math.max( 1, growProfile.growCallCount - availableThreads )
        const totalGrowingTime      = growingTime * threadedGrowCallCount

        const growthToWeakenTimeRatio = growingTime/weakeningTime

        const totalWeakenCalls        = await CalculateTotalWeakenCalls( ns, connectionName, growProfile.growCallCount, growProfile.growSecurityDeltaPercentage, growthToWeakenTimeRatio )
        const postWeakenThreadCount   = Math.max( 1, postGrowThreadCount - totalWeakenCalls)
        const threadedWeakenCallCount = Math.max( 1, totalWeakenCalls - postGrowThreadCount)
        const totalWeakeningTime      = weakeningTime * threadedWeakenCallCount

        await UnpauseScriptsOnServer( ns, pauseData )

        const endTime = new Date()

        const timeToMoneyRatio = GetTimeForEarningRatio( hackingTime + totalGrowingTime + totalWeakeningTime, maxMoney * hackPercentage )

        ns.tprint( connectionName + " Time to Money Ratio: " + timeToMoneyRatio )
        
        const moneyPerHack = maxMoney * hackPercentage
        const threadedHackProfit = moneyPerHack * postWeakenThreadCount
        const serverOverdraw = threadedHackProfit - maxMoney

        //This is a dumb estimation that doesn't account for dimishing returns.
        const threadsToHack = moneyPerHack > 0 ? Math.floor( maxMoney / moneyPerHack ) : 0

        //THIS IS MOST LIKELY WRONG AND WE SHOULD RE-MATH IT.
        const totalThreadCount = threadsToHack + growProfile.growCallCount + totalWeakenCalls

        ns.tprint( "Thread Estimation for " + connectionName + ": " + totalThreadCount )

        if ( serverOverdraw > 0 )
        {
          ns.tprint( "OVER DRAW WARNING: hacking " + connectionName + " with " + postWeakenThreadCount + " threads overdraws account by " + serverOverdraw + ", this wastes cpu cycles." )
        
          let overdrawRatio = serverOverdraw / maxMoney

          ns.tprint( "Overdraw Ratio: " + overdrawRatio )
        
        }
        
        ns.tprint( "Evaluation of server " + connectionName + " completed after " +  GetReadableDateDelta( endTime.getTime() - startTime.getTime() ) )

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
          growProfile.growCallCount,
          totalWeakenCalls,
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

//Note this function assume a hack at max server value.
function CalculateMoneyPerHack( ns, targetServer)
{
  const maxMoney = ns.getServerMaxMoney( targetServer )
  const hackPercent = ns.hackAnalyze( targetServer )
  const moneyEarned = maxMoney * hackPercent

  return moneyEarned
}

function GetTimeForEarningRatio( time, moneyEarned )
{
  if ( time <= 0 )
    return moneyEarned

  return moneyEarned / time
}

async function CalculateGrowProfile( ns, targetServer )
{
  //TO DO: we should determine if we want to evaluate this from current money and sec positions,
  // or from min to max positions. The first will vary based on server state, the other is constant.

  let pregrowMoney = ns.getServerMoneyAvailable( targetServer )
  let pregrowSec   = ns.getServerSecurityLevel( targetServer )

  //TO DO: if pregrowMoney == maxMoney, there is no point in measuring growth.

  await ns.grow( targetServer )
  
  const maxMoney = ns.getServerMaxMoney( targetServer )
  const curMoney = ns.getServerMoneyAvailable( targetServer )
  const curSec   = ns.getServerSecurityLevel( targetServer )

  //We have to handle the case where other scripts are hacking this server.
  if ( pregrowMoney > curMoney )
  {
    debugger
    pregrowMoney = curMoney
  }

  if ( pregrowSec > curSec )
  {
    debugger
    pregrowSec = curSec
  }

  const moneyDelta  = curMoney - pregrowMoney
  const secDelta    = curSec - pregrowSec

  //Determine how much grow call increased account money and how much it raised security level.
  const growPercentage = pregrowMoney > 0 ? moneyDelta / pregrowMoney : 0
  const growSecPercentage = pregrowSec > 0 ? secDelta / pregrowSec : 0

  let reqGrowCount = 0

  if ( growPercentage <= 0 )
    return new GrowCallProfileData( reqGrowCount, growSecPercentage )

  //Grow from current account position.
  //let postGrowMoney = curMoney

  //Grow from empty account (Cannot be zero or infinite loop will result).
  let postGrowMoney = 1
  
  while( postGrowMoney < maxMoney )
  {
    reqGrowCount++
    postGrowMoney += postGrowMoney * growPercentage
  }

  return new GrowCallProfileData( reqGrowCount, growSecPercentage )
}

async function CalculateTotalWeakenCalls( ns, targetServer, growCallCount, growSecurityDeltaPercentage, growthToWeakenTimeRatio )
{
  let preWeakenSec  = ns.getServerSecurityLevel( targetServer )
  const minSec      = ns.getServerMinSecurityLevel( targetServer )
  const maxSec      = ns.getServerBaseSecurityLevel( targetServer )

  //TO DO: if preWeakenSec == minSec there is no point in profiling this.

  await ns.weaken( targetServer )

  const curSec = ns.getServerSecurityLevel( targetServer )

  //We have to handle the case where other scripts are hacking this server.
  if (  curSec > preWeakenSec )
  {
    debugger
    preWeakenSec = curSec
  }
    

  const weakenSecDelta = preWeakenSec - curSec

  if ( weakenSecDelta <= 0 )
    return 0

  const weakenDeltaPercentage = weakenSecDelta / preWeakenSec

  let postGrowSec = curSec

  //TO DO: We need to calculate a weakTime to growTime ratio to see how many weaken calls can happen per growCall
  //We then need to use that to find how many threads are needed at one time.

  //TO DO: This assumes all the growing is done before all the weakening, 
  //in reality, they run in parallell, is there a way to mix them to get a more accurate account?
  
  let reqWeakenCount = 0
  let parallellWeakenCalls = 0

  if ( growSecurityDeltaPercentage > 0 )
  {
    for ( let i = 0; i < growCallCount; i++ )
    {
      postGrowSec += postGrowSec * growSecurityDeltaPercentage

      //Don't go above max security level.
      postGrowSec = Math.min( maxSec, postGrowSec )
      postGrowSec = Math.max( minSec, postGrowSec )

      if ( postGrowSec > minSec )
        parallellWeakenCalls += growthToWeakenTimeRatio

      while ( parallellWeakenCalls >= 1 )
      {
        reqWeakenCount++
        postGrowSec -= postGrowSec * weakenDeltaPercentage
        parallellWeakenCalls -= 1
      }
    }
  }

  while ( postGrowSec > minSec )
  {
    reqWeakenCount++
    postGrowSec -= postGrowSec * weakenDeltaPercentage
  }

  return reqWeakenCount
  
}

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

function GrowCallProfileData( growCallCount, growSecurityDeltaPercentage )
{
  this.growCallCount                = growCallCount
  this.growSecurityDeltaPercentage  = growSecurityDeltaPercentage
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
  const hackScript    = "server-hack.js"
  const growScript    = "server-grow.js"
  const weakenScript  = "server-weaken.js"

  const hackScriptRam = ns.getScriptRam( hackScript )
  const growScriptRam = ns.getScriptRam( growScript )
  const weakScriptRam = ns.getScriptRam( weakenScript )

  //For now assign the farming script for the search to be the script with the highest ram cost.
  let farmingScript = hackScript
  if ( growScriptRam > hackScriptRam )
    farmingScript = growScript
  else if ( weakScriptRam > hackScriptRam && weakScriptRam > growScriptRam )
    farmingScript = weakenScript


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

    //Get total available threads for script at the time search finishes.
    //This allows us to include any new servers and memory upgrades in our final script deployment.
    let availableThreads = GetTotalAvailableThreadsForScript( ns, "home", "home", farmingScript )

    let totalRequiredThreads = 0;
    for ( let i = 0; i < searchedServers.length; i++ )
    {
      let sortedServer = searchedServers[ i ]
      totalRequiredThreads += sortedServer.requiredTotalThreads 
    }

    const threadRequirementDelta = availableThreads - totalRequiredThreads

    for ( let i = 0; i < searchedServers.length; i++  )
    {

      if ( availableThreads <= 0  )
        break

      let sortedServer = searchedServers[ i ]

      //Skip servers with no monatary value.
      if ( sortedServer.heuristic <= 0  )
        continue

      const scriptNameList = [ growScript, weakenScript, hackScript ]
      const scriptArgsList = [ [sortedServer.name], [sortedServer.name], [sortedServer.name] ]

      if ( sortedServer.requiredTotalThreads > availableThreads )
      {
        const clampedGrowThreads = Math.max( 0, availableThreads -= sortedServer.requiredGrowThreads )
        const clampodWeakenThreads = Math.max( 0, availableThreads -= sortedServer.requiredWeakenThreads )
        const clampedHackThreads = Math.max( 0, availableThreads -= sortedServer.requiredHackThreads )

        const threadCountList = [ clampedGrowThreads, clampodWeakenThreads, clampedHackThreads ]
        DistributeScriptsToNetwork( ns, scriptNameList, scriptArgsList, threadCountList )
      }
      else
      {
        const threadCountList = [ sortedServer.requiredGrowThreads, sortedServer.requiredWeakenThreads, sortedServer.requiredHackThreads ]
        DistributeScriptsToNetwork( ns, scriptNameList, scriptArgsList, threadCountList )
      }
      
      availableThreads -= sortedServer.requiredTotalThreads      
    }

    //Use a binary search to hone in on best search time.
    if ( threadRequirementDelta > 0 )
    {
      ns.tprint( "We have unused threads after targeting all valid servers, doubling search window." )
      evaluationIncrement *= 2
    }
    else if ( threadRequirementDelta < 0 )
    {
      ns.tprint( "Threads required to hack all return servers is higher than what we have available, shrinking search window." )
      evaluationIncrement *= 0.75
    }     

    await ns.sleep( 20000 )
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

    if ( growingTime + weakeningTime > maxEvaluationTime )
    {
      ns.tprint( GetReadableDateDelta( growingTime + weakeningTime ) + " is longer than max evaluation time of " + GetReadableDateDelta( maxEvaluationTime ) + ", skipping " + connectionName )
    }
    else
    {
      if ( myHackingLevel >= serverHackingLevel && rootAccess )
      {     

        //Get availble threads to see if it has changed mid-process.
        const availableThreads = GetTotalAvailableThreadsForScript( ns, "home", "home", farmingScript )

        const moneyAvailable    = ns.getServerMoneyAvailable( connectionName )
        const maxMoney          = ns.getServerMaxMoney( connectionName )

        const securityLevel     = ns.getServerSecurityLevel( connectionName )
        const secMinLevel       = ns.getServerMinSecurityLevel( connectionName )

        const hackPercentage    = ns.hackAnalyze( connectionName )
        
        const startTime = new Date()

        //We have to halt all processing on the server so hacking doesn't mess up our measurements.
        let pauseData = PauseAllServersTargetingGivenServer( ns, "home", "home", connectionName )

        const growProfile           = await CalculateGrowProfile( ns, connectionName )
        const postGrowThreadCount   = Math.max( 1, availableThreads - growProfile.growCallCount )
        const threadedGrowCallCount = Math.max( 1, growProfile.growCallCount - availableThreads )
        const totalGrowingTime      = growingTime * threadedGrowCallCount

        const growthToWeakenTimeRatio = growingTime/weakeningTime

        const totalWeakenCalls        = await CalculateTotalWeakenCalls( ns, connectionName, growProfile.growCallCount, growProfile.growSecurityDeltaPercentage, growthToWeakenTimeRatio )
        const postWeakenThreadCount   = Math.max( 1, postGrowThreadCount - totalWeakenCalls)
        const threadedWeakenCallCount = Math.max( 1, totalWeakenCalls - postGrowThreadCount)
        const totalWeakeningTime      = weakeningTime * threadedWeakenCallCount

        await UnpauseScriptsOnServer( ns, pauseData )

        const endTime = new Date()

        const timeToMoneyRatio = GetTimeForEarningRatio( hackingTime + totalGrowingTime + totalWeakeningTime, maxMoney * hackPercentage )

        ns.tprint( connectionName + " Time to Money Ratio: " + timeToMoneyRatio )
        
        const moneyPerHack = maxMoney * hackPercentage
        const threadedHackProfit = moneyPerHack * postWeakenThreadCount
        const serverOverdraw = threadedHackProfit - maxMoney

        //This is a dumb estimation that doesn't account for dimishing returns.
        const threadsToHack = moneyPerHack > 0 ? Math.floor( maxMoney / moneyPerHack ) : 0

        //THIS IS MOST LIKELY WRONG AND WE SHOULD RE-MATH IT.
        const totalThreadCount = threadsToHack + growProfile.growCallCount + totalWeakenCalls

        ns.tprint( "Thread Estimation for " + connectionName + ": " + totalThreadCount )

        if ( serverOverdraw > 0 )
        {
          ns.tprint( "OVER DRAW WARNING: hacking " + connectionName + " with " + postWeakenThreadCount + " threads overdraws account by " + serverOverdraw + ", this wastes cpu cycles." )
        
          let overdrawRatio = serverOverdraw / maxMoney

          ns.tprint( "Overdraw Ratio: " + overdrawRatio )
        
        }
        
        ns.tprint( "Evaluation of server " + connectionName + " completed after " +  GetReadableDateDelta( endTime.getTime() - startTime.getTime() ) )

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
          growProfile.growCallCount,
          totalWeakenCalls,
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

//Note this function assume a hack at max server value.
function CalculateMoneyPerHack( ns, targetServer)
{
  const maxMoney = ns.getServerMaxMoney( targetServer )
  const hackPercent = ns.hackAnalyze( targetServer )
  const moneyEarned = maxMoney * hackPercent

  return moneyEarned
}

function GetTimeForEarningRatio( time, moneyEarned )
{
  if ( time <= 0 )
    return moneyEarned

  return moneyEarned / time
}

async function CalculateGrowProfile( ns, targetServer )
{
  //TO DO: we should determine if we want to evaluate this from current money and sec positions,
  // or from min to max positions. The first will vary based on server state, the other is constant.

  let pregrowMoney = ns.getServerMoneyAvailable( targetServer )
  let pregrowSec   = ns.getServerSecurityLevel( targetServer )

  //TO DO: if pregrowMoney == maxMoney, there is no point in measuring growth.

  await ns.grow( targetServer )
  
  const maxMoney = ns.getServerMaxMoney( targetServer )
  const curMoney = ns.getServerMoneyAvailable( targetServer )
  const curSec   = ns.getServerSecurityLevel( targetServer )

  //We have to handle the case where other scripts are hacking this server.
  if ( pregrowMoney > curMoney )
  {
    debugger
    pregrowMoney = curMoney
  }

  if ( pregrowSec > curSec )
  {
    debugger
    pregrowSec = curSec
  }

  const moneyDelta  = curMoney - pregrowMoney
  const secDelta    = curSec - pregrowSec

  //Determine how much grow call increased account money and how much it raised security level.
  const growPercentage = pregrowMoney > 0 ? moneyDelta / pregrowMoney : 0
  const growSecPercentage = pregrowSec > 0 ? secDelta / pregrowSec : 0

  let reqGrowCount = 0

  if ( growPercentage <= 0 )
    return new GrowCallProfileData( reqGrowCount, growSecPercentage )

  //Grow from current account position.
  //let postGrowMoney = curMoney

  //Grow from empty account (Cannot be zero or infinite loop will result).
  let postGrowMoney = 1
  
  while( postGrowMoney < maxMoney )
  {
    reqGrowCount++
    postGrowMoney += postGrowMoney * growPercentage
  }

  return new GrowCallProfileData( reqGrowCount, growSecPercentage )
}

async function CalculateTotalWeakenCalls( ns, targetServer, growCallCount, growSecurityDeltaPercentage, growthToWeakenTimeRatio )
{
  let preWeakenSec  = ns.getServerSecurityLevel( targetServer )
  const minSec      = ns.getServerMinSecurityLevel( targetServer )
  const maxSec      = ns.getServerBaseSecurityLevel( targetServer )

  //TO DO: if preWeakenSec == minSec there is no point in profiling this.

  await ns.weaken( targetServer )

  const curSec = ns.getServerSecurityLevel( targetServer )

  //We have to handle the case where other scripts are hacking this server.
  if (  curSec > preWeakenSec )
  {
    debugger
    preWeakenSec = curSec
  }
    

  const weakenSecDelta = preWeakenSec - curSec

  if ( weakenSecDelta <= 0 )
    return 0

  const weakenDeltaPercentage = weakenSecDelta / preWeakenSec

  let postGrowSec = curSec

  //TO DO: We need to calculate a weakTime to growTime ratio to see how many weaken calls can happen per growCall
  //We then need to use that to find how many threads are needed at one time.

  //TO DO: This assumes all the growing is done before all the weakening, 
  //in reality, they run in parallell, is there a way to mix them to get a more accurate account?
  
  let reqWeakenCount = 0
  let parallellWeakenCalls = 0

  if ( growSecurityDeltaPercentage > 0 )
  {
    for ( let i = 0; i < growCallCount; i++ )
    {
      postGrowSec += postGrowSec * growSecurityDeltaPercentage

      //Don't go above max security level.
      postGrowSec = Math.min( maxSec, postGrowSec )
      postGrowSec = Math.max( minSec, postGrowSec )

      if ( postGrowSec > minSec )
        parallellWeakenCalls += growthToWeakenTimeRatio

      while ( parallellWeakenCalls >= 1 )
      {
        reqWeakenCount++
        postGrowSec -= postGrowSec * weakenDeltaPercentage
        parallellWeakenCalls -= 1
      }
    }
  }

  while ( postGrowSec > minSec )
  {
    reqWeakenCount++
    postGrowSec -= postGrowSec * weakenDeltaPercentage
  }

  return reqWeakenCount
  
}