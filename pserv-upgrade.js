
import { UnpauseScriptsOnServer } from "utility.js"
import { PauseScriptsOnServer } from "utility.js"

/** @param {NS} ns */
export async function main(ns) {
    // How much RAM each purchased server will have.
    const ram = ns.args[0];

    // Iterator we'll use for our loop
    let purchasedServers = ns.getPurchasedServers();

    let i = 0;

    while ( i < purchasedServers.length )
    {
      if ( ns.getServerMoneyAvailable("home") > ns.getPurchasedServerCost(ram) ) 
      {
        let server = purchasedServers[i]

        let pausedScripts = PauseScriptsOnServer(ns, server)

        ns.deleteServer( server )

        const newServer = ns.purchaseServer( server, ram )

        if ( newServer != "" )
        {
          ns.tprint( "Upgraded " + server + " to " + ram + "GB Ram." )

          //We need to copy the script to the new server before we try to unpause.
          for ( let j = 0; j < pausedScripts.length; j++ )
          {
            let pausedScript = pausedScripts[j]
            ns.scp( pausedScript.scriptName, pausedScript.hostServerName )
          }
          
          await UnpauseScriptsOnServer( ns, pausedScripts )

          //Move to next server.
          i++
        }
        else
        {
          ns.tprint( "Server Upgrade for " + server + " failed, check logs." )
        }
      }

      await ns.sleep(125);
    }

    ns.tprint( "All Servers Upgraded to " + ram + "GB Ram. Ending Script." )
}