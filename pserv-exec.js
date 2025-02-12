import { GetThreadCountForScript } from "utility.js"

/** @param {NS} ns */
export async function main(ns) 
{
  debugger
  const scriptName = ns.args[0]
  
  let scriptArgs = ns.args
  scriptArgs.shift()

  const servers = ns.getPurchasedServers()

  for ( var i = 0; i < servers.length; i++ )
  {
    const server = servers[i]
    ns.killall( server )

    const threads = GetThreadCountForScript( ns, scriptName, server )

    ns.scp( scriptName, server )
    ns.exec( scriptName, server, threads, ...scriptArgs )
  }

}