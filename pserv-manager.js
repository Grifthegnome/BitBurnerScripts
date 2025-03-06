import { UnpauseScriptsOnServer } from "utility.js"
import { PauseScriptsOnServer } from "utility.js"

/** @param {NS} ns */
export async function main(ns) 
{
    const startingRam = 2
    const endingRam = 65536

    await BuyServers( ns, startingRam )

    while ( GetLowestPServRam( ns ) <= endingRam )
    {
      await UpgradeServers( ns )
    }

    ns.tprint( "Servers fully upgraded. Ending Script." )
}

async function BuyServers( ns, startingRam )
{
  // How much RAM each purchased server will have. In this case, it'll
    const ram = startingRam;

    // Iterator we'll use for our loop
    let i = ns.getPurchasedServers().length;

    // Continuously try to purchase servers until we've reached the maximum
    // amount of servers
    while (i < ns.getPurchasedServerLimit()) 
    {
        // Check if we have enough money to purchase a server
        if (ns.getServerMoneyAvailable("home") > ns.getPurchasedServerCost(ram)) 
        {
            let hostname = ns.purchaseServer("pserv-" + i, ram);
            ns.tprint( "Purchased " + hostname + " at " + ram + "GB Ram." )
            ++i;
        }
        //Make the script wait for a second before looping again.
        //Removing this line will cause an infinite loop and crash the game.
        await ns.sleep(125);
    }
}

async function UpgradeServers( ns )
{
  // Iterator we'll use for our loop
    let purchasedServers = ns.getPurchasedServers();

    for ( let i = 0 ; i < purchasedServers.length; i++ )
    {
      let server = purchasedServers[ i ]

      const serverInfo = ns.getServer( server )

      //If our current ram usage is less than 80%, we don't need to upgrade this server.
      if ( serverInfo.ramUsed < serverInfo.maxRam * 0.8 )
        continue

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

        }
        else
        {
          ns.tprint( "Server Upgrade for " + server + " failed, check logs." )
        }
      }
    }

    await ns.sleep(125);
}

function GetLowestPServRam( ns )
{
  let purchasedServers = ns.getPurchasedServers();

  let lowestRam = -1

  for ( let i = 0; i < purchasedServers.length; i++ )
  {
    const serverInfo = ns.getServer( purchasedServers[i] )

    if ( lowestRam == -1 )
    {
      lowestRam = serverInfo.maxRam
      continue 
    }
      
    if ( serverInfo.maxRam < lowestRam )
      lowestRam = serverInfo.maxRam
  }

  return lowestRam

}