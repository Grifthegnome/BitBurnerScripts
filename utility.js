
function ServerLedgerData(  )
{

}

export function AvailableServerData( name, availableThreads )
{
  this.name             = name
  this.availableThreads = availableThreads
}

export function ScriptPauseData( hostServerName, scriptName, threadCount, scriptArgs )
{
  this.hostServerName = hostServerName
  this.scriptName     = scriptName
  this.threadCount    = threadCount
  this.scriptArgs     = scriptArgs
}

/** @param {NS} ns */
export async function main(ns) {

}

export function GetReadableDateDelta( delta )
{
  let seconds = Math.floor( delta/ 1000 )
  let minutes = Math.floor( seconds / 60 )
  let hours   = Math.floor( minutes / 60 )
  let days    = Math.floor( hours / 24 )

  seconds = seconds % 60
  minutes = minutes % 60
  hours   = hours % 24

  const dayText = days + " days"
  const hoursText = hours + " hours"
  const minText = minutes + " minutes"
  const secText = seconds + " seconds"

  let readableData = ""

  if ( days > 0 )
  {
    readableData += dayText
  }

  if ( hours > 0 )
  {
    if ( days > 0 )
      readableData += ", "

    readableData += hoursText
  }

  if ( minutes > 0 )
  {

    if ( days > 0 || hours > 0 )
      readableData += ", "

    readableData += minText

  }

  if ( days > 0 || hours > 0 || minutes > 0 )
    readableData += ", "

  readableData += secText

  return readableData
}

export function GetThreadCountForScript( ns, scriptName, serverName )
{
  const scriptRam     = ns.getScriptRam( scriptName )
  const ramUsed       = ns.getServerUsedRam( serverName )
  const ramLimit      = ns.getServerMaxRam( serverName )
  const availableRam  = ramLimit - ramUsed

  const threads = Math.floor( availableRam / scriptRam )

  return threads
}

export function GetMaxThreadCountForScript( ns, scriptName, serverName )
{
  const scriptRam     = ns.getScriptRam( scriptName )
  const ramLimit      = ns.getServerMaxRam( serverName )

  const threads = Math.floor( ramLimit / scriptRam )

  return threads
}

export function PauseScriptsOnServer( ns, serverName )
{
  let runningScripts = ns.ps( serverName )

  let pausedScriptData = Array()

  for( let i = 0; i < runningScripts.length; i++ )
  {
    const script = runningScripts[i]

    let scriptData = new ScriptPauseData( serverName, script.filename, script.threads, script.args )

    pausedScriptData.push( scriptData )

    ns.kill( script.pid )
  }

  return pausedScriptData

}

export function PauseScriptsTargetingServerOnGivenServer( ns, hostName, targetServer )
{
  let runningScripts = ns.ps( hostName )

  let pausedScriptData = Array()

  for( let i = 0; i < runningScripts.length; i++ )
  {
    if ( i > 0 )
      debugger

    const script = runningScripts[i]
    const scriptArgs = script.args
    //Note: We are assuming that the appearance of the targetServer's name anywhere in a script's arguments means it is the target.
    for ( let j = 0; j < scriptArgs.length; j++ )
    {
      let arg = scriptArgs[ j ]
      if ( arg == targetServer )
      {
        let scriptData = new ScriptPauseData( hostName, script.filename, script.threads, script.args )
        pausedScriptData.push( scriptData )
        ns.kill( script.pid )
      }
    }
  }

  return pausedScriptData

}

export async function UnpauseScriptsOnServer( ns, pausedScriptData )
{
  for( let i = 0; i < pausedScriptData.length; i++ )
  {
    if ( i > 0 )
      debugger

    let pausedScript = pausedScriptData[ i ]

    ns.exec( pausedScript.scriptName, pausedScript.hostServerName, pausedScript.threadCount, ...pausedScript.scriptArgs )
  }

  //We need to give the exec calls time to run.
  await ns.sleep( 100 )
}

export function ServerIsTargetingGivenServer( ns, hostServer, targetServer )
{
  const runningScripts = ns.ps( hostServer )
  for ( let i = 0; i < runningScripts.length; i++ )
  {
    let script = runningScripts[ i ]
    let scriptArgs = script.args

    //Note: We are assuming that the appearance of the targetServer's name anywhere in a script's arguments means it is the target.
    for ( let j = 0; j < scriptArgs.length; j++ )
    {
      let arg = scriptArgs[ j ]

      if ( arg == targetServer )
        return true
    }
  }

  return false

}

export function PauseAllServersTargetingGivenServer( ns, hostServer, parentServer, targetServer )
{  
  //This should be called with "home" as the starting server by the caller.
  const connections = ns.scan( hostServer )

  let finalPauseList = Array()

  for ( let i = 0; i < connections.length; i++ )
  {
    const currentConnection = connections[ i ]

    if ( currentConnection == parentServer )
      continue

    if ( ServerIsTargetingGivenServer(ns, currentConnection, targetServer) )
    {
      let pausedServerScripts = PauseScriptsTargetingServerOnGivenServer(ns, currentConnection, targetServer)

      if ( pausedServerScripts.length > 0 )
        finalPauseList = finalPauseList.concat( pausedServerScripts )
    
    }

    let branchPausedServerScripts = PauseAllServersTargetingGivenServer( ns, currentConnection, hostServer, targetServer )
    
    if ( branchPausedServerScripts.length > 0 )
      finalPauseList = finalPauseList.concat( branchPausedServerScripts )

  }

  return finalPauseList

}

export function GetTotalAvailableThreadsForScript( ns, hostServer, parentServer, scriptName )
{  
  const ramCost = ns.getScriptRam( scriptName )

  //This should be called with "home" as the starting server by the caller.
  const connections = ns.scan( hostServer )

  let totalThreadCount = 0

  for ( let i = 0; i < connections.length; i++ )
  {
    const currentConnection = connections[ i ]

    if ( currentConnection == parentServer )
      continue

    if ( ns.hasRootAccess( currentConnection ) )
    {
      let availableThreads = GetMaxThreadCountForScript( ns, scriptName, currentConnection )
      totalThreadCount += availableThreads
    }
      
    let branchThreads = GetTotalAvailableThreadsForScript( ns, currentConnection, hostServer, scriptName )
    totalThreadCount += branchThreads

  }

  return totalThreadCount

}

export function KillAllNetworkProcesses( ns, hostServer, parentServer )
{  
  //This should be called with "home" as the starting server by the caller.
  const connections = ns.scan( hostServer )

  let availableServerList = Array()

  for ( let i = 0; i < connections.length; i++ )
  {
    const currentConnection = connections[ i ]

    if ( currentConnection == parentServer )
      continue

    if ( ns.hasRootAccess( currentConnection ) )
      ns.killall( currentConnection )
    
    //Kill processes in sub-networks.
    KillAllNetworkProcesses( ns, currentConnection, hostServer )
    
  }

  return availableServerList

}

export function GetAvailableServersForScript( ns, hostServer, parentServer, scriptName )
{  
  //This should be called with "home" as the starting server by the caller.
  const connections = ns.scan( hostServer )

  let availableServerList = Array()

  for ( let i = 0; i < connections.length; i++ )
  {
    const currentConnection = connections[ i ]

    if ( currentConnection == parentServer )
      continue

    if ( ns.hasRootAccess( currentConnection ) )
    {
      let availableThreads = GetThreadCountForScript( ns, scriptName, currentConnection )

      if ( availableThreads > 0 )
      {
        let availableServer = new AvailableServerData( currentConnection, availableThreads )
        availableServerList.push( availableServer )
      }
        
    }
      
    let branchAvailableServers = GetAvailableServersForScript( ns, currentConnection, hostServer, scriptName )
    
    if ( branchAvailableServers.length > 0 )
      availableServerList = availableServerList.concat( branchAvailableServers )

  }

  return availableServerList

}

export function AllocateThreadsForScript( ns, threadCount, scriptName, scriptArgs )
{
  let availableServerList = GetAvailableServersForScript( ns, "home", "home", scriptName )

  for ( let i = 0; i < availableServerList.length; i++ )
  {
    if ( threadCount <= 0 )
      break

    let availableServer = availableServerList[ i ]

    if ( availableServer.availableThreads > threadCount )
    {
      ns.tprint( "Server " + availableServer.name + ": Starting " + threadCount + " instances of " + scriptName + " with args " + scriptArgs )
      ns.exec( scriptName, availableServer.name, threadCount, ...scriptArgs )

      availableServer.availableThreads -= threadCount
      threadCount = 0
    }
    else
    {
      ns.tprint( "Server " + availableServer.name + ": Starting " + availableServer.availableThreads + " instances of " + scriptName + " with args " + scriptArgs )
      ns.exec( scriptName, availableServer.name, availableServer.availableThreads, ...scriptArgs )

      threadCount -= availableServer.availableThreads
      availableServer.availableThreads = 0
    }
  }
}

export function BruteForceServer( ns, serverName )
{
  //Brute Force Ports
  if (ns.fileExists("BruteSSH.exe", "home")) 
      ns.brutessh(serverName);

  if ( ns.fileExists( "FTPCrack.exe", "home" ) )
    ns.ftpcrack( serverName )

  if ( ns.fileExists( "relaySMTP.exe", "home" ) )
    ns.relaysmtp( serverName )

  if ( ns.fileExists( "HTTPWorm.exe", "home" ) )
    ns.httpworm( serverName )

  if ( ns.fileExists( "SQLInject.exe", "home" ) )
    ns.sqlInject( serverName )
  
}