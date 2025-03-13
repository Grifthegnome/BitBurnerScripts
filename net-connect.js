import { FindServerAndBackTrace } from "utility.js"

/** @param {NS} ns */
export async function main(ns) 
{
  
  if ( !(ns.singularity) )
  {
    ns.tprint( "You don't have access to the singularity API." )
    ns.tprint( "Terminating script." )
    return
  }

  const serverToFind = ns.args[0]
  
  const backtrackStack = FindServerAndBackTrace( ns, "home", "home", serverToFind )
  
  if ( backtrackStack.length > 0 )
  {

    ns.tprint( "Server " + serverToFind + " found, connecting." )

    ns.singularity.connect( "home" )

    for ( let i = 0; i < backtrackStack.length; i++ )
    {
      const backtrackServer = backtrackStack[i]
      ns.singularity.connect( backtrackServer )
    }
  }
  else
  {
    ns.tprint( "Could Not Connect To " + serverToFind + ", server not found in network." )
  }  
}