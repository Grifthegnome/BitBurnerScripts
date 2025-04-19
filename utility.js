const SERVER_LOCK_FILE_NAME                         = "servers_locked.txt"
const SERVER_RAM_PREALLOCATION_FILENAME             = "servers_ram_prealloc.txt"
const SERVER_RAM_PREALLOCATION_ACTIVE_KEYS_FILENAME = "servers_ram_prealloc_active_keys.txt"

export function AvailableServerData( name, availableThreads, availableRam )
{
  this.name             = name
  this.availableThreads = availableThreads
  this.availableRam     = availableRam
}

export function ScriptPauseData( hostServerName, scriptName, threadCount, scriptArgs )
{
  this.hostServerName = hostServerName
  this.scriptName     = scriptName
  this.threadCount    = threadCount
  this.scriptArgs     = scriptArgs
}

/** @param {NS} ns */
export async function main(ns) 
{

}

export function AddCommasToNumber( number )
{
  let numberAsString = Math.trunc(number).toString()
  let insertIndices = Array()
  for ( let i = numberAsString.length - 3; i > 0; i -= 3 )
  {
    insertIndices.push( i - 1 )
  }

  let finalString = ""
  for ( let i = 0; i < numberAsString.length; i++ )
  {
    finalString += numberAsString[i]

    if ( insertIndices.includes( i ) )
      finalString += ","
  }

  return finalString

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
  const preallocRam   = GetTotalPreallocatedRamForServerExcludingActiveKeys( ns, serverName )
  const availableRam  = (ramLimit - preallocRam) - ramUsed

  const threads = Math.floor( availableRam / scriptRam )

  return threads
}

export function GetMaxThreadCountForScript( ns, scriptName, serverName )
{
  const scriptRam     = ns.getScriptRam( scriptName )
  const preallocRam   = GetTotalPreallocatedRamForServerExcludingActiveKeys( ns, serverName )
  const ramLimit      = ns.getServerMaxRam( serverName )

  const threads = Math.floor( (ramLimit - preallocRam) / scriptRam )

  return threads
}

export function GetAvailableRamForServer( ns, serverName )
{
  const ramLimit      = ns.getServerMaxRam( serverName )
  const ramUsed       = ns.getServerUsedRam( serverName )
  const preallocRam   = GetTotalPreallocatedRamForServerExcludingActiveKeys( ns, serverName )
  const ramAvailable  = ( ramLimit - preallocRam ) - ramUsed

  return Math.max( ramAvailable, 0 )
}

export function GetMaxRamForServer( ns, serverName )
{
  const ramLimit      = ns.getServerMaxRam( serverName )
  const preallocRam   = GetTotalPreallocatedRamForServerExcludingActiveKeys( ns, serverName )

  return Math.max( ramLimit - preallocRam, 0 )
}

export function KillAllNetworkProcesses( ns, hostServer, parentServer )
{  
  //This should be called with "home" as the starting server by the caller.
  const connections = ns.scan( hostServer )

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
}

export function KillDuplicateScriptsOnHost( ns, scriptName )
{
  let processes = ns.ps( ns.getHostname() )
  for ( var i = 0; i < processes.length; i++ )
  {
    const process = processes[i]

    if ( process.filename == scriptName.filename && process.pid != scriptName.pid )
    {
      ns.kill( process.pid )
    }
  }
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

export function FindServerAndBackTrace( ns, hostServer, parentServer, serverToFind )
  {
    //This should be called with "home" as the starting server by the caller.
    const connections = ns.scan( hostServer )
  
    let backtrackStack = Array()
  
    for ( let i = 0; i < connections.length; i++ )
    {
      const currentConnection = connections[ i ]
  
      if ( currentConnection == parentServer )
        continue
  
      if ( currentConnection == serverToFind )
      {
        backtrackStack.push( currentConnection )
  
        return backtrackStack
      }
      
      //Search processes in sub-networks.
      const searchResults = FindServerAndBackTrace( ns, currentConnection, hostServer, serverToFind )
    
      if ( searchResults.length > 0 )
      {
        backtrackStack.push( currentConnection )
        backtrackStack = backtrackStack.concat( searchResults )
  
        return backtrackStack
      }
    
    }
  
    return backtrackStack
  }

export async function LockServer( ns, serverName )
{
  if ( ns.fileExists( SERVER_LOCK_FILE_NAME ) )
  {
    const jsonStringRead = ns.read( SERVER_LOCK_FILE_NAME )
    let lockedServers = JSON.parse( jsonStringRead )

    if ( !lockedServers.includes( serverName ) )
      lockedServers.push( serverName )

    const jsonStringWrite = JSON.stringify( lockedServers )
    await ns.write( SERVER_LOCK_FILE_NAME, jsonStringWrite, "w" )
  }
  else
  {
    let lockedServers = [ serverName ]
    const jsonStringWrite = JSON.stringify( lockedServers )
    await ns.write( SERVER_LOCK_FILE_NAME, jsonStringWrite, "w" )
  }
}

export function IsServerLocked( ns, serverName )
{
  if ( ns.fileExists( SERVER_LOCK_FILE_NAME ) )
  {
    const jsonString = ns.read( SERVER_LOCK_FILE_NAME )
    let lockedServers = JSON.parse( jsonString )

    return lockedServers.includes( serverName )
  }

  return false
}

export async function UnlockServer( ns, serverName )
{
  if ( ns.fileExists( SERVER_LOCK_FILE_NAME ) )
  {
    const jsonStringRead = ns.read( SERVER_LOCK_FILE_NAME )
    let lockedServers = JSON.parse( jsonStringRead )

    if ( lockedServers.includes( serverName ) )
    {
      const index = lockedServers.indexOf( serverName )
      lockedServers.splice( index, 1 )

      const jsonStringWrite = JSON.stringify( lockedServers )
      await ns.write( SERVER_LOCK_FILE_NAME, jsonStringWrite, "w" )
    }
  }
}

export async function UnlockAllServers( ns )
{
  if ( ns.fileExists( SERVER_LOCK_FILE_NAME ) )
    ns.rm( SERVER_LOCK_FILE_NAME )
}

export async function SetActiveRamPreallocationKeys( ns, allocationKeys )
{

  if ( !Array.isArray(allocationKeys) )
    throw new Error( "allocationKeys must be an array." )

  const jsonStringWrite = JSON.stringify( allocationKeys )
  await ns.write( SERVER_RAM_PREALLOCATION_ACTIVE_KEYS_FILENAME, jsonStringWrite, "w" )
}

export async function ClearActiveRamPreallocationKeys( ns )
{
  if ( ns.fileExists( SERVER_RAM_PREALLOCATION_ACTIVE_KEYS_FILENAME ) )
  {
    ns.rm( SERVER_RAM_PREALLOCATION_ACTIVE_KEYS_FILENAME )
  }
}

export async function PreallocateServerRamForKey( ns, serverName, allocationKey, ram )
{
  if ( ns.fileExists( SERVER_RAM_PREALLOCATION_FILENAME ) )
  {
    const jsonStringRead = ns.read( SERVER_RAM_PREALLOCATION_FILENAME )
    let serverPreallocations = JSON.parse( jsonStringRead )

    if ( serverName in serverPreallocations )
    {
      if ( allocationKey in serverPreallocations[serverName] )
      {
        const previouslyAllocatedRam = serverPreallocations[serverName][allocationKey]
        const totalRamAlloc = previouslyAllocatedRam + ram
        serverPreallocations[serverName][allocationKey] = totalRamAlloc

        //To Do: We need to make sure the total number of preallocations across keys don't exceed the server's ram limit.
      }
      else
      {
        let allocationForKey = {}
        allocationForKey[ allocationKey ] = ram
        serverPreallocations[ serverName ] = allocationForKey
      }
    }
    else
    {
      let allocationForKey = {}
      allocationForKey[ allocationKey ] = ram
      serverPreallocations[ serverName ] = allocationForKey
    }

    const jsonStringWrite = JSON.stringify( serverPreallocations )
    await ns.write( SERVER_RAM_PREALLOCATION_FILENAME, jsonStringWrite, "w" )
  }
  else
  {
    let allocationForKey = {}
    allocationForKey[ allocationKey ] = ram
    let serverPreallocations = {}
    serverPreallocations[serverName] = allocationForKey

    const jsonStringWrite = JSON.stringify( serverPreallocations )
    await ns.write( SERVER_RAM_PREALLOCATION_FILENAME, jsonStringWrite, "w" )
  }
}

export function GetTotalPreallocatedRamForServerExcludingActiveKeys( ns, serverName )
{
  let excludedKeys = []
  if ( ns.fileExists( SERVER_RAM_PREALLOCATION_ACTIVE_KEYS_FILENAME ) )
  {
    const jsonStringRead = ns.read( SERVER_RAM_PREALLOCATION_ACTIVE_KEYS_FILENAME )
    excludedKeys = JSON.parse( jsonStringRead )
  }

  let totalPreallocatedRam = 0

  if ( ns.fileExists( SERVER_RAM_PREALLOCATION_FILENAME ) )
  {
    const jsonStringRead = ns.read( SERVER_RAM_PREALLOCATION_FILENAME )
    let serverPreallocations = JSON.parse( jsonStringRead )

    if ( serverName in serverPreallocations )
    {
      const allocationKeys = Object.keys( serverPreallocations[serverName] )
      for ( let i = 0; i < allocationKeys.length; i++ )
      {
        const allocationKey = allocationKeys[i]
        if ( excludedKeys.includes( allocationKey ) )
          continue

        totalPreallocatedRam += serverPreallocations[serverName][allocationKey]
      } 
    }    
  }

  return totalPreallocatedRam

}

export function GetTotalPreallocatedRamForServerForActiveKeys( ns, serverName )
{
  let activeKeys = []
  if ( ns.fileExists( SERVER_RAM_PREALLOCATION_ACTIVE_KEYS_FILENAME ) )
  {
    const jsonStringRead = ns.read( SERVER_RAM_PREALLOCATION_ACTIVE_KEYS_FILENAME )
    activeKeys = JSON.parse( jsonStringRead )
  }

  let totalPreallocatedRam = 0

  if ( ns.fileExists( SERVER_RAM_PREALLOCATION_FILENAME ) )
  {
    const jsonStringRead = ns.read( SERVER_RAM_PREALLOCATION_FILENAME )
    let serverPreallocations = JSON.parse( jsonStringRead )

    if ( serverName in serverPreallocations )
    {
      const allocationKeys = Object.keys( serverPreallocations[serverName] )
      for ( let i = 0; i < allocationKeys.length; i++ )
      {
        const allocationKey = allocationKeys[i]
        if ( !activeKeys.includes( allocationKey ) )
          continue

        totalPreallocatedRam += serverPreallocations[serverName][allocationKey]
      } 
    }    
  }

  return totalPreallocatedRam

}

export async function ReleasePreallocatedServerRamForKeyOnServer( ns, serverName, allocationKey )
{
  if ( ns.fileExists( SERVER_RAM_PREALLOCATION_FILENAME ) )
  {
    const jsonStringRead = ns.read( SERVER_RAM_PREALLOCATION_FILENAME )
    let serverPreallocations = JSON.parse( jsonStringRead )

    if ( serverName in serverPreallocations )
    {
      if ( allocationKey in serverPreallocations[serverName] )
      {
        delete serverPreallocations[serverName][ allocationKey ]

        if ( Object.keys( serverPreallocations[serverName] ).length == 0 )
          delete serverPreallocations[ serverName ]

        const jsonStringWrite = JSON.stringify( serverPreallocations )
        await ns.write( SERVER_RAM_PREALLOCATION_FILENAME, jsonStringWrite, "w" )
      }
    }
  }
}

export async function ReleaseAllPreallocatedServerRamForKey( ns, allocationKey )
{
  if ( ns.fileExists( SERVER_RAM_PREALLOCATION_FILENAME ) )
  {
    const jsonStringRead = ns.read( SERVER_RAM_PREALLOCATION_FILENAME )
    let serverPreallocations = JSON.parse( jsonStringRead )

    const serverNames = Object.keys( serverPreallocations )
    let serversToRemove = []

    for( let i = 0; i < serverNames.length; i++ )
    {
      const serverName = serverNames[i]
      if ( serverName in serverPreallocations )
      {
        if ( allocationKey in serverPreallocations[serverName] )
        {
          delete serverPreallocations[serverName][allocationKey]

          if ( Object.keys( serverPreallocations[serverName] ).length == 0 )
            serversToRemove.push( serverName )
        }
      }
    }

    for( let i = 0; i < serversToRemove.length; i++ )
    {
      const serverToRemove = serversToRemove[i]
      delete serverPreallocations[serverToRemove]
    }

    const jsonStringWrite = JSON.stringify( serverPreallocations )
    await ns.write( SERVER_RAM_PREALLOCATION_FILENAME, jsonStringWrite, "w" )

  }
}

export function GetTotalAvailableThreadsForScript( ns, hostServer, parentServer, scriptName )
{  

  //This should be called with "home" as the starting server by the caller.
  const connections = ns.scan( hostServer )

  let totalThreadCount = 0

  for ( let i = 0; i < connections.length; i++ )
  {
    const currentConnection = connections[ i ]

    if ( currentConnection == parentServer )
      continue

    if ( ns.hasRootAccess( currentConnection ) && !IsServerLocked( ns, currentConnection )  )
    {
      let availableThreads = GetThreadCountForScript( ns, scriptName, currentConnection )
      totalThreadCount += availableThreads
    }
      
    let branchThreads = GetTotalAvailableThreadsForScript( ns, currentConnection, hostServer, scriptName )
    totalThreadCount += branchThreads

  }

  return totalThreadCount

}

export function GetMaxThreadsForScript( ns, hostServer, parentServer, scriptName )
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

    if ( ns.hasRootAccess( currentConnection ) && !IsServerLocked( ns, currentConnection ) )
    {
      let availableThreads = GetMaxThreadCountForScript( ns, scriptName, currentConnection )
      totalThreadCount += availableThreads
    }
      
    let branchThreads = GetMaxThreadsForScript( ns, currentConnection, hostServer, scriptName )
    totalThreadCount += branchThreads

  }

  return totalThreadCount

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

    if ( ns.hasRootAccess( currentConnection ) && !IsServerLocked( ns, currentConnection ) )
    {
      let availableThreads = GetThreadCountForScript( ns, scriptName, currentConnection )

      if ( availableThreads > 0 )
      {
        let availableServer = new AvailableServerData( currentConnection, availableThreads, -1 )
        availableServerList.push( availableServer )
      }
        
    }
      
    let branchAvailableServers = GetAvailableServersForScript( ns, currentConnection, hostServer, scriptName )
    
    if ( branchAvailableServers.length > 0 )
      availableServerList = availableServerList.concat( branchAvailableServers )

  }

  return availableServerList

}

export function AllocateThreadsForScriptToGivenServers( ns, threadCount, scriptName, scriptArgs, availableServerList )
{
  availableServerList.sort( (serverDataA, serverDataB ) => GetMaxRamForServer( ns, serverDataB.name ) - GetMaxRamForServer( ns, serverDataA.name ) )

  let threadsAllocated = 0

  for ( let i = 0; i < availableServerList.length; i++ )
  {
    if ( threadCount <= 0 )
      break

    let availableServer = availableServerList[ i ]

    if ( IsServerLocked( ns, availableServer.name ) )
      continue

    if ( availableServer.availableThreads > threadCount )
    {
      
      ns.scp( scriptName, availableServer.name )
      //ns.tprint( "Server " + availableServer.name + ": Starting " + threadCount + " instances of " + scriptName + " with args " + scriptArgs )
      ns.exec( scriptName, availableServer.name, threadCount, ...scriptArgs )

      threadsAllocated += threadCount

      availableServer.availableThreads -= threadCount
      threadCount = 0
    }
    else
    {
      
      ns.scp( scriptName, availableServer.name )
      //ns.tprint( "Server " + availableServer.name + ": Starting " + availableServer.availableThreads + " instances of " + scriptName + " with args " + scriptArgs )
      ns.exec( scriptName, availableServer.name, availableServer.availableThreads, ...scriptArgs )

      threadsAllocated += availableServer.availableThreads

      threadCount -= availableServer.availableThreads
      availableServer.availableThreads = 0
    }
  }

  return threadsAllocated

}

export function DistribueScriptsToHome( ns, scriptNameList, scriptArgsList, threadCountList )
{

  if ( scriptNameList.length != scriptArgsList.length && scriptNameList.length != threadCountList.length )
    throw new Error( "scriptNameList, scriptArgsList, and threadCountList much have matching lengths." )

  let totalThreadsAllocated = 0

  for ( let i = 0; i < scriptNameList.length; i++ )
  {

    const scriptName  = scriptNameList[ i ]
    const scriptArgs  = scriptArgsList[ i ]
    const threadCount = threadCountList[ i ] 

    if ( threadCount == 0 )
      continue

    let availableThreads = GetThreadCountForScript( ns, scriptName, "home" )

    if ( availableThreads > 0 )
    {
      const homeServerData = new AvailableServerData( "home", availableThreads, -1 )
    
      const availableServerList = [ homeServerData ]

      const threadsAllocated = AllocateThreadsForScriptToGivenServers( ns, threadCount, scriptName, scriptArgs, availableServerList )
    
      if ( threadsAllocated == 0 )
        break

      totalThreadsAllocated += threadsAllocated
    }
  }

  return totalThreadsAllocated

}

export function DistributeScriptsToNetwork( ns, scriptNameList, scriptArgsList, threadCountList, preAllocationKeys )
{
  /*
  This function should be provided an array of script names, a 2D array of script args, and an array
  of thread counts. The indices in each array corrospond to each other, so all three arrays must have
  matching lengths.

  We prioritize running scripts from first to last index.
  */

  /*
  Note: Remember that we allow servers to have chunks of ram preallocated for certain tasks. Unless the keys are set as active, This function will not be able to access 
  that ram.
  */

  //SET ACTIVE KEYS
  SetActiveRamPreallocationKeys( ns, preAllocationKeys )


  if ( scriptNameList.length != scriptArgsList.length && scriptNameList.length != threadCountList.length )
    throw new Error( "scriptNameList, scriptArgsList, and threadCountList much have matching lengths." )

  let totalThreadsAllocated = 0

  for ( let i = 0; i < scriptNameList.length; i++ )
  {

    const scriptName  = scriptNameList[ i ]
    const scriptArgs  = scriptArgsList[ i ]
    const threadCount = threadCountList[ i ] 

    if ( threadCount == 0 )
      continue

    const availableServerList = GetAvailableServersForScript( ns, "home", "home", scriptName )
    const threadsAllocated = AllocateThreadsForScriptToGivenServers( ns, threadCount, scriptName, scriptArgs, availableServerList )
    
    if ( threadsAllocated == 0 )
      break

    totalThreadsAllocated += threadsAllocated
  }

  //CLEAR ACTIVE KEYS
  ClearActiveRamPreallocationKeys( ns )

  return totalThreadsAllocated
}

export function PreallocateRamForKeyOnNetwork( ns, preallocatedRam, allocationKey )
{

  let availableServerList = GetBestServersToPreallocateRamForKeyOnNetwork( ns, "home", "home" )
  availableServerList.sort( (serverDataA, serverDataB ) => serverDataB.availableRam - serverDataA.availableRam )

  let remainingRamNeeded = preallocatedRam

  for ( let i = 0; i < availableServerList.length; i++ )
  {

    if ( remainingRamNeeded <= 0 )
      break

    const serverData = availableServerList[i]

    if ( serverData.availableRam < remainingRamNeeded )
    {
      PreallocateServerRamForKey( ns, serverData.name, allocationKey, serverData.availableRam )
      remainingRamNeeded -= serverData.availableRam
    }
    else
    {
      PreallocateServerRamForKey( ns, serverData.name, allocationKey, remainingRamNeeded )
      remainingRamNeeded -= remainingRamNeeded
    }
  }
}

function GetBestServersToPreallocateRamForKeyOnNetwork( ns, hostServer, parentServer )
{  
  //This should be called with "home" as the starting server by the caller.
  const connections = ns.scan( hostServer )

  let availableServerList = Array()

  for ( let i = 0; i < connections.length; i++ )
  {
    const currentConnection = connections[ i ]

    if ( currentConnection == parentServer )
      continue

    if ( ns.hasRootAccess( currentConnection ) && !IsServerLocked( ns, currentConnection ) )
    {
      let maxRam = GetMaxRamForServer( ns, currentConnection )

      if ( maxRam > 0 )
      {
        let availableServer = new AvailableServerData( currentConnection, -1, maxRam )
        availableServerList.push( availableServer )
      }
    }
      
    let branchAvailableServers = GetBestServersToPreallocateRamForKeyOnNetwork( ns, currentConnection, hostServer )
    
    if ( branchAvailableServers.length > 0 )
      availableServerList = availableServerList.concat( branchAvailableServers )

  }

  return availableServerList

}

export function GetPreallocateRamForActiveKeysOnNetwork( ns, hostServer, parentServer )
{  
  //This should be called with "home" as the starting server by the caller.
  const connections = ns.scan( hostServer )

  let availableServerList = Array()

  let totalPreallocatedRam = 0

  for ( let i = 0; i < connections.length; i++ )
  {
    const currentConnection = connections[ i ]

    if ( currentConnection == parentServer )
      continue

    if ( ns.hasRootAccess( currentConnection ) && !IsServerLocked( ns, currentConnection ) )
    {
      totalPreallocatedRam += GetTotalPreallocatedRamForServerForActiveKeys(ns, currentConnection)
    }
      
    totalPreallocatedRam += GetPreallocateRamForActiveKeysOnNetwork( ns, currentConnection, hostServer )
  }

  return totalPreallocatedRam
  
}

export function GetPreallocateRamExcludingActiveKeysOnNetwork( ns, hostServer, parentServer )
{  
  //This should be called with "home" as the starting server by the caller.
  const connections = ns.scan( hostServer )

  let availableServerList = Array()

  let totalPreallocatedRam = 0

  for ( let i = 0; i < connections.length; i++ )
  {
    const currentConnection = connections[ i ]

    if ( currentConnection == parentServer )
      continue

    if ( ns.hasRootAccess( currentConnection ) && !IsServerLocked( ns, currentConnection ) )
    {
      totalPreallocatedRam += GetTotalPreallocatedRamForServerExcludingActiveKeys(ns, currentConnection)
    }
      
    totalPreallocatedRam += GetPreallocateRamExcludingActiveKeysOnNetwork( ns, currentConnection, hostServer )
  }

  return totalPreallocatedRam
  
}

export function GetTotalThreadsRunningScriptOnHome( ns, scriptName, matchingArgs )
{
  let threadCount = 0

  const currentConnection = "home"

  if ( ns.hasRootAccess( currentConnection ) )
  {
    const runningScripts = ns.ps( currentConnection )

    for ( let j = 0; j < runningScripts.length; j++ )
    {
      const script = runningScripts[j]

      if ( script.filename ==  scriptName )
      {
        if ( script.args.length < matchingArgs.length )
          continue

        let argsMatch = true
        for ( let argIndex = 0; argIndex < matchingArgs.length; argIndex++ )
        {
          if ( script.args[ argIndex ] != matchingArgs[ argIndex ] )
          {
            argsMatch = false
            break
          }
        }

        if ( argsMatch )
          threadCount += script.threads
      }
    }      
  }

  return threadCount
}

export function GetTotalThreadsRunningScriptOnNetwork( ns, hostServer, parentServer, scriptName, matchingArgs )
{
  //This should be called with "home" as the starting server by the caller.
  const connections = ns.scan( hostServer )

  let threadCount = 0

  for ( let i = 0; i < connections.length; i++ )
  {
    const currentConnection = connections[ i ]

    if ( currentConnection == parentServer )
      continue

    if ( ns.hasRootAccess( currentConnection ) )
    {
      const runningScripts = ns.ps( currentConnection )

      for ( let j = 0; j < runningScripts.length; j++ )
      {
        const script = runningScripts[j]

        if ( script.filename ==  scriptName )
        {
          if ( script.args.length < matchingArgs.length )
            continue

          let argsMatch = true
          for ( let argIndex = 0; argIndex < matchingArgs.length; argIndex++ )
          {
            if ( script.args[ argIndex ] != matchingArgs[ argIndex ] )
            {
              argsMatch = false
              break
            }
          }

          if ( argsMatch )
            threadCount += script.threads
        }
      }

      threadCount += GetTotalThreadsRunningScriptOnNetwork( ns, currentConnection, hostServer, scriptName, matchingArgs )        
    }
  }

  return threadCount

}

export function GetTotalAvailableRamOnNetwork( ns, hostServer, parentServer )
{  
  //This should be called with "home" as the starting server by the caller.
  const connections = ns.scan( hostServer )

  let totalAvailableRam = 0

  for ( let i = 0; i < connections.length; i++ )
  {
    const currentConnection = connections[ i ]

    if ( currentConnection == parentServer )
      continue

    if ( ns.hasRootAccess( currentConnection ) && !IsServerLocked( ns, currentConnection ) )
    {
      let availableRam = GetAvailableRamForServer( ns, currentConnection )
      totalAvailableRam += availableRam
    }
      
    let subNetAvailableRam = GetTotalAvailableRamOnNetwork( ns, currentConnection, hostServer )
    totalAvailableRam += subNetAvailableRam

  }

  return totalAvailableRam

}

export function GetMaxRamOnNetwork( ns, hostServer, parentServer )
{  
  //This should be called with "home" as the starting server by the caller.
  const connections = ns.scan( hostServer )

  let totalMaxRam = 0

  for ( let i = 0; i < connections.length; i++ )
  {
    const currentConnection = connections[ i ]

    if ( currentConnection == parentServer )
      continue

    if ( ns.hasRootAccess( currentConnection ) && !IsServerLocked( ns, currentConnection ) )
    {
      let maxRam = GetMaxRamForServer( ns, currentConnection )
      totalMaxRam += maxRam
    }
      
    let subNetMaxRam = GetTotalAvailableRamOnNetwork( ns, currentConnection, hostServer )
    totalMaxRam += subNetMaxRam

  }

  return totalMaxRam

}

export function GetCompanyList()
{  
  const companyList = [
    "AeroCorp",
    "Alpha Enterprises",
    "Bachman & Associates",
    "Blade Industries",
    "Central Intelligence Agency",
    "Carmichael Security",
    "Clarke Incorporated",
    "CompuTek",
    "DefComm",
    "DeltaOne",
    "ECorp",
    "FoodNStuff",
    "Four Sigma",
    "Fulcrum Technologies",
    "Galactic Cybersystems",
    "Global Pharmaceuticals",
    "Helios Labs",
    "Icarus Microsystems",
    "Joe's Guns",
    "KuaiGong International",
    "LexoCorp",
    "MegaCorp",
    "National Security Agency",
    "NWO",
    "NetLink Technologies",
    "Noodle Bar",
    "Nova Medical",
    "Omega Software",
    "OmniTek Incorporated",
    "Omnia Cybersystems",
    "Aevum Police Headquarters",
    "Rho Construction",
    "Solaris Space Systems",
    "Storm Technologies",
    "SysCore Securities",
    "Universal Energy",
    "VitaLife",
    "Watchdog Security",
    ]

  return companyList

}

export function ServerIsPersonalServer( ns, serverName )
{
  const personalServers = ns.getPurchasedServers()
  return personalServers.includes( serverName )
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
    ns.sqlinject( serverName )
  
}

export function FindAllFilesWithExtensionOnServer( ns, serverName, fileExtension, copyToHome )
{
  const files = ns.ls( serverName )
  const filteredFiles = files.filter( file => file.endsWith( fileExtension ) )

  if ( filteredFiles.length > 0 )
  {
    ns.tprint( "\n" )
    ns.tprint( filteredFiles.length + " files found @ " + serverName )
  }
    

  for ( let i = 0; i < filteredFiles.length; i++ )
  {
    let file = filteredFiles[i]

    if ( copyToHome )
    {
      ns.scp( file, "home", serverName )
      ns.tprint( file + " copied to home" )
    }
    else
    {

      switch( fileExtension )
      {
        case ".cct":
          const type = ns.codingcontract.getContractType( file, serverName )
          ns.tprint( file + " " + type )
        break

        default:
          ns.tprint( file )
        break
      }
    }
  }

  return filteredFiles

}

export function SearchNetworkForFilesWithExtension( ns, hostServer, parentServer, fileExtension, copyToHome )
{  
  //This should be called with "home" as the starting server by the caller.
  const connections = ns.scan( hostServer )

  let matchingFiles = Array()

  for ( let i = 0; i < connections.length; i++ )
  {
    const currentConnection = connections[ i ]

    if ( currentConnection == parentServer )
      continue

    const newMatches = FindAllFilesWithExtensionOnServer( ns, currentConnection, fileExtension, copyToHome )

    if ( newMatches.length > 0 )
      matchingFiles = matchingFiles.concat( newMatches )
    
    //Search processes in sub-networks.
    const subNetMatches = SearchNetworkForFilesWithExtension( ns, currentConnection, hostServer, fileExtension, copyToHome )
  
    if ( subNetMatches.length > 0 )
      matchingFiles = matchingFiles.concat( subNetMatches )
  
  }

  return matchingFiles
  
}

export function FindFirstServerWithFile( ns, hostServer, parentServer, fileName )
{
  //This should be called with "home" as the starting server by the caller.
  const connections = ns.scan( hostServer )

  for ( let i = 0; i < connections.length; i++ )
  {
    const currentConnection = connections[ i ]

    if ( currentConnection == parentServer )
      continue

    if ( ns.fileExists( fileName, currentConnection ) )
      return currentConnection
    
    //Search in sub-networks
    const subSearchResult = FindFirstServerWithFile( ns, currentConnection, hostServer, fileName )

    if ( subSearchResult != "" )
      return subSearchResult

  }

  return ""

}

export function ArraysAreEqual(array1, array2) 
{
    // Check if the lengths are equal
    if (array1.length !== array2.length) {
        return false;
    }

    // Sort both arrays
    array1 = array1.slice().sort()
    array2 = array2.slice().sort()

    // Compare each element
    for (let i = 0; i < array1.length; i++) 
    {
        if (array1[i] !== array2[i]) 
            return false;
    }

    return true
}

export function ArraySwapElements(array, index1, index2) 
{
    // Check if indices are within the valid range
    if (index1 < 0 || index1 >= array.length || index2 < 0 || index2 >= array.length) 
    {
        console.error("Invalid indices")
        return
    }

    let returnArray = array.slice()

    // Perform the swap
    const temp = returnArray[index1];
    returnArray[index1] = returnArray[index2];
    returnArray[index2] = temp

    return returnArray
}