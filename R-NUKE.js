import { BruteForceServer } from "utility.js"

//This script recursively nukes all servers in a network we can access, starting from the host computer.

/** @param {NS} ns */
export async function main(ns) 
{
  
  const hostName = "home"//ns.getHostname()

  ns.print( "hostName: " + hostName )

  ns.tprint( "\n")

  SearchAndNukeServers ( ns, hostName, hostName )

  ns.tprint( "Opperation Completed")
}

function SearchAndNukeServers( ns, hostServer, parentServer )
{

  const myServers = ns.getPurchasedServers()

  const connections = ns.scan( hostServer )

  for( var i = 0; i < connections.length; i++ )
  {
    const connectionName = connections[i]
    ns.print( "connection name: " + connectionName )

    if ( connectionName == "syscore" )
      debugger

    if ( connectionName == parentServer )
    {
      ns.print( "connected server is parent server, skipping." )
      continue
    }

    //Skip servers we own.
    if ( myServers.indexOf( connectionName ) != -1 )
    {
      ns.print( "Skipping a server because we own it." )
      continue
    }

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
        ns.tprint( "Gained Root Access to " + connectionName )
      }
    }

    //Install our global helper scripts on the server.
    if ( ns.hasRootAccess( connectionName ) )
    {
      //Add any scripts you want on all servers here.
      ns.scp( "homerun.js", connectionName )
      ns.scp( "R-NUKE.js", connectionName )
      ns.scp( "net-scan.js", connectionName )
      ns.scp( "net-backtrace.js", connectionName )
      ns.scp( "contract-open.js", connectionName )
      ns.scp( "contract-find.js", connectionName )
      ns.scp( "utility.js", connectionName )
      
    }
    SearchAndNukeServers( ns, connectionName, hostServer )
  }
}