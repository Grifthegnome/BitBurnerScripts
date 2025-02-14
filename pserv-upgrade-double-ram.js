
import { UnpauseScriptsOnServer } from "utility.js"
import { PauseScriptsOnServer } from "utility.js"

/** @param {NS} ns */
export async function main(ns) 
{
    // Iterator we'll use for our loop
    let purchasedServers = ns.getPurchasedServers();

    let i = 0;

    while ( i < purchasedServers.length )
    {
      let server = purchasedServers[i]

      const serverInfo = ns.getServer( server )

      //Double onboard ram
      const ramUpgrade = serverInfo.maxRam * 2

      if ( ns.getServerMoneyAvailable("home") > ns.getPurchasedServerCost(ramUpgrade) ) 
      {
        

        let pausedScripts = PauseScriptsOnServer(ns, server)

        ns.deleteServer( server )

        const newServer = ns.purchaseServer( server, ramUpgrade )

        if ( newServer != "" )
        {
          ns.tprint( "Upgraded " + server + " to " + ramUpgrade + "GB Ram." )

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

    ns.tprint( "All Servers Upgraded. Ending Script." )
}