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
export async function main(ns) 
{

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

export function GetAvailableRamForServer( ns, serverName )
{
  const ramLimit      = ns.getServerMaxRam( serverName )
  const ramUsed       = ns.getServerUsedRam( serverName )
  const ramAvailable  = ramLimit - ramUsed

  return ramAvailable
}

export function GetMaxRamForServer( ns, serverName )
{
  return ns.getServerMaxRam( serverName )
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

    if ( ns.hasRootAccess( currentConnection ) )
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

export function AllocateThreadsForScriptToGivenServers( ns, threadCount, scriptName, scriptArgs, availableServerList )
{
  availableServerList.sort( (serverDataA, serverDataB ) => ns.getServerMaxRam( serverDataA.name ) - ns.getServerMaxRam( serverDataB.name ) )

  let threadsAllocated = 0

  for ( let i = 0; i < availableServerList.length; i++ )
  {
    if ( threadCount <= 0 )
      break

    let availableServer = availableServerList[ i ]

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
      const homeServerData = new AvailableServerData( "home", availableThreads )
    
      const availableServerList = [ homeServerData ]

      const threadsAllocated = AllocateThreadsForScriptToGivenServers( ns, threadCount, scriptName, scriptArgs, availableServerList )
    
      if ( threadsAllocated == 0 )
        break

      totalThreadsAllocated += threadsAllocated
    }
  }

  return totalThreadsAllocated

}

export function DistributeScriptsToNetwork( ns, scriptNameList, scriptArgsList, threadCountList )
{
  /*
  This function should be provided an array of script names, a 2D array of script args, and an array
  of thread counts. The indices in each array corrospond to each other, so all three arrays must have
  matching lengths.

  We prioritize running scripts from first to last index.
  */

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

  return totalThreadsAllocated
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

    if ( ns.hasRootAccess( currentConnection ) )
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

    if ( ns.hasRootAccess( currentConnection ) )
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