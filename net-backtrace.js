import { FindServerAndBackTrace } from "utility.js"

/** @param {NS} ns */
export async function main(ns) {

    //run4theh111z
  
    const serverToFind = ns.args[0]
  
    const backtrackStack = FindServerAndBackTrace( ns, "home", "home", serverToFind )
  
    if ( backtrackStack.length > 0 )
    {

      ns.tprint( "Server " + serverToFind + " found, backtracing to home." )

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
  