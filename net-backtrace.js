/** @param {NS} ns */
export async function main(ns) {

    //run4theh111z
  
    const serverToFind = ns.args[0]
  
    const backtrackStack = FindServerAndBackTrace( ns, "home", "home", serverToFind )
  
    if ( backtrackStack.length > 0 )
    {
      for ( let i = 0; i < backtrackStack.length; i++ )
      {
        const backtrackServer = backtrackStack[i]
  
        const serverInfo = ns.getServer( backtrackServer )
  
        const printString = serverInfo.backdoorInstalled ? backtrackServer + " ===> HAS BACKDOOR " : backtrackServer  
  
        ns.tprint( printString )
      }
    }
    else
    {
      ns.tprint( "Could Not Back Track Server " + serverToFind + ", server not found in network." )
    }
  
  }
  
  function FindServerAndBackTrace( ns, hostServer, parentServer, serverToFind )
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
        ns.tprint( "Server " + serverToFind + " found, backtracing to home" )
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
  