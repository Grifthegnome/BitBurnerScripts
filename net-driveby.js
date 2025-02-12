import { GetThreadCountForScript } from "utility.js"
import { BruteForceServer } from "utility.js"

//This script recursively nukes all servers in a network we can access, starting from the host computer.
//It then installs and runs the specified script.
/** @param {NS} ns */
export async function main(ns) 
{
  
  const driveByScript = ns.args[0]

  let scriptArgs = ns.args
  scriptArgs.shift()

  const parentServer = ns.getHostname()

  ns.print( "parent server: " + parentServer )

  TakeOverServerAndRunScript( ns, parentServer, parentServer, driveByScript, ...scriptArgs )
}

function TakeOverServerAndRunScript( ns, targetServer, parentServer, driveByScript, ...scriptArgs )
{
  const connections = ns.scan( targetServer )

  for( var i = 0; i < connections.length; i++ )
  {
    const connectionName = connections[i]
    ns.print( "connection name: " + connectionName )

    if ( connectionName == parentServer )
    {
      ns.print( "connected server is parent server, skipping." )
      continue
    }

    //Brute Force Ports
    BruteForceServer( ns, connectionName )

    const server = ns.getServer( connectionName )
    const portsRequired = server.numOpenPortsRequired

    ns.print ( server.openPortCount + " of " + portsRequired + " required to nuke." )

    if ( portsRequired <= server.openPortCount )
    {
      if ( !ns.hasRootAccess( connectionName ) )
      {
        ns.print ( portsRequired + " ports required for nuke, Nuking System" )
        ns.nuke( connectionName )
      }
      
      ns.killall( connectionName )

      const threads = GetThreadCountForScript( ns, driveByScript, connectionName )

      if ( threads > 0 )
      {
        //Pass along the driveby script
        ns.scp( driveByScript, connectionName )
        ns.exec( driveByScript, connectionName, threads, ...scriptArgs )
      }
    }

    TakeOverServerAndRunScript( ns, connectionName, targetServer, driveByScript, ...scriptArgs )

  }
}