

//This script searches the network for low security, high-yield servers.

import { GetReadableDateDelta } from "utility.js"
import { GetTotalAvailableThreadsForScript } from "utility.js"
import { UnpauseScriptsOnServer } from "utility.js"
import { PauseAllServersTargetingGivenServer } from "utility.js"
import { AllocateThreadsForScript } from "utility.js"
import { KillAllNetworkProcesses } from "utility.js"

/** @param {NS} ns */
function ServerData( name, money, maxMoney, securityLevel, secMinLevel, hackingLevel, hackingTime, totalGrowingTime, totalWeakeningTime, hackPercentage, requiredThreads )
{
  this.name                 = name
  this.money                = money
  this.maxMoney             = maxMoney
  this.securityLevel        = securityLevel
  this.secMinLevel          = secMinLevel
  this.hackingLevel         = hackingLevel
  this.hackingTime          = hackingTime
  this.totalGrowingTime     = totalGrowingTime
  this.totalWeakeningTime   = totalWeakeningTime
  this.requiredThreads      = requiredThreads
  this.totalTime            = hackingTime + totalGrowingTime + totalWeakeningTime

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
  //TO DO: We need to consider avaiable threads and compute overhacking of an account effecting out return.

  //TO DO: If we overdraw an account on a single server, we should find out how many threads we need not to overdraw, then hack other servers with remaining threads.

  const farmingScript = "farm-server.js"

  const maxEvaluationTime = ( ns.args[0] * 60 ) * 1000

  const parentServer = ns.getHostname()

  ns.print( "parent server: " + parentServer )

  let lastServerData = new ServerData( "", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 )

  while ( true )
  {
    let searchStartTime = new Date()

    let availableThreads = GetTotalAvailableThreadsForScript( ns, "home", "home", farmingScript )

    let searchedServers = await ServerSearch( ns, parentServer, parentServer, maxEvaluationTime, availableThreads )

    let searchEndTime = new Date()

    ns.tprint( "Server search completed after " + GetReadableDateDelta( searchEndTime.getTime() - searchStartTime.getTime() ) )

    searchedServers.sort( (a, b) => b.heuristic - a.heuristic )

    if ( searchedServers.length > 0 )
    {
      KillAllNetworkProcesses( ns, "home", "home" )
    }

    for ( let i = 0; i < searchedServers.length; i++  )
    {

      if ( availableThreads <= 0  )
        break

      let sortedServer = searchedServers[ i ]
      let scriptArgs = [ sortedServer.name ]

      if ( sortedServer.requiredThreads > availableThreads )
        AllocateThreadsForScript( ns, availableThreads, farmingScript, scriptArgs )
      else
        AllocateThreadsForScript( ns, sortedServer.requiredThreads, farmingScript, scriptArgs )
      
      availableThreads -= sortedServer.requiredThreads      
    }

    await ns.sleep( 20000 )
  }  
  
}

async function ServerSearch( ns, targetServer, parentServer, maxEvaluationTime, availableThreads )
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

        const totalWeakenCalls        = await CalculateTotalWeakenCalls( ns, connectionName, growProfile.growCallCount, growProfile.growSecurityDeltaPercentage )
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
        const threadsToHack = Math.floor( maxMoney / moneyPerHack )

        //THIS IS MOST LIKELY WRONG AND WE SHOULD RE-MATH IT.
        const totalThreadCount = threadsToHack + growProfile.growCallCount + totalWeakenCalls

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
          totalThreadCount
          )

          searchedServers.push( serverData )
        }
      }
    }

    let branchServerSearch = await ServerSearch( ns, connectionName, targetServer, maxEvaluationTime, availableThreads )

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

  const growPercentage = moneyDelta / pregrowMoney
  const growSecPercentage = secDelta / pregrowSec

  let reqGrowCount = 0

  if ( growPercentage <= 0 )
    return new GrowCallProfileData( reqGrowCount, growSecPercentage )

  let postGrowMoney = curMoney
  
  while( postGrowMoney < maxMoney )
  {
    reqGrowCount++
    postGrowMoney += postGrowMoney * growPercentage
  }

  return new GrowCallProfileData( reqGrowCount, growSecPercentage )
}

async function CalculateTotalWeakenCalls( ns, targetServer, growCallCount, growSecurityDeltaPercentage )
{
  let preWeakenSec  = ns.getServerSecurityLevel( targetServer )
  const minSec      = ns.getServerMinSecurityLevel( targetServer )

  await ns.weaken( targetServer )

  const curSec = ns.getServerSecurityLevel( targetServer )

  //We have to handle the case where other scripts are hacking this server.
  if (  curSec > preWeakenSec )
  {
    debugger
    preWeakenSec = curSec
  }
    

  const weakenSecDelta = preWeakenSec - curSec

  if ( weakenSecDelta == 0 )
    return 0

  const weakenDeltaPercentage = weakenSecDelta / preWeakenSec

  let postGrowSec = curSec

  if ( growSecurityDeltaPercentage > 0 )
  {
    for ( let i = 0; i < growCallCount; i++ )
    {
      postGrowSec += postGrowSec * growSecurityDeltaPercentage
    }
  }

  let reqWeakenCount = 0
  while ( postGrowSec > minSec )
  {
    reqWeakenCount++
    postGrowSec -= postGrowSec * weakenDeltaPercentage
  }

  return reqWeakenCount
  
}