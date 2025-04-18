import { LockServer } from "utility.js"
import { IsServerLocked } from "utility.js"
import { UnlockServer } from "utility.js"
import { UnlockAllServers } from "utility.js"

const MAX_RAM_UPGRADE_TARGET = 524288

/** @param {NS} ns */
export async function main(ns) 
{
    const startingRam = 2
    const endingRam = MAX_RAM_UPGRADE_TARGET

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

            //We want servers to start locked so that we can upgrade them as far as possible before unlocking them.
            if ( !IsServerLocked( ns, hostname ) && ns.getServerMoneyAvailable("home") > ns.getPurchasedServerCost(startingRam * 2) )
              await LockServer( ns, hostname )

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

    let serversAtCapacity = true
    for ( let i = 0; i < purchasedServers.length; i++ )
    {
      const server = purchasedServers[ i ]

      if ( IsServerLocked( ns, server ) )
        continue

      const serverInfo = ns.getServer( server )
      //If our current ram usage is less than 80%, we don't need to upgrade this server.
      if ( serverInfo.ramUsed < serverInfo.maxRam * 0.8 )
      {
        serversAtCapacity = false
        break
      }
    }

    if ( serversAtCapacity )
    {

      const server = GetBestServerToUpgrade( ns )
      const serverInfo = ns.getServer( server )

      //Double onboard ram
      let ramUpgrade = serverInfo.maxRam * 2

      if ( ns.getServerMoneyAvailable("home") > ns.getPurchasedServerCost(ramUpgrade) )
      {
        //We want to lock the server so threads stop getting allocated to it.
        if ( !IsServerLocked( ns, server ) )
          await LockServer( ns, server )

        let testUpgrade = ramUpgrade
        while ( ns.getServerMoneyAvailable("home") > ns.getPurchasedServerCost(testUpgrade) && MAX_RAM_UPGRADE_TARGET > ramUpgrade )
        {
          ramUpgrade = testUpgrade
          testUpgrade = ramUpgrade * 2
        }

        const usedRam = ns.getServerUsedRam( server )

        //Once we can afford it and the server is no longer running tasks, we can upgrade it.
        if ( ns.getServerMoneyAvailable("home") > ns.getPurchasedServerCost(ramUpgrade) && usedRam == 0 ) 
        {
          ns.killall(server)
          ns.deleteServer( server )

          const newServer = ns.purchaseServer( server, ramUpgrade )

          //Unlock the server so it can start running tasks again.
          await UnlockServer( ns, newServer )

          if ( newServer != "" )
            ns.tprint( "Upgraded " + server + " to " + ramUpgrade + "GB Ram." )
          else
            ns.tprint( "Server Upgrade for " + server + " failed, check logs." )
        }
      }
    }
    
    if ( ns.fileExists( "unused_thread_report.txt", "home" ) )
    {
      const jsonStringRead = ns.read( "unused_thread_report.txt" )
      let unusedThreadCount = JSON.parse( jsonStringRead )
      
      if ( unusedThreadCount > 0 )
        UnlockAllServers( ns )
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

function GetBestServerToUpgrade( ns )
{
  let purchasedServers = ns.getPurchasedServers();

  if ( purchasedServers.length == 0 )
    return ""

  purchasedServers.sort( (a, b) => ns.getServer(a).maxRam - ns.getServer(b).maxRam  )

  const lowestRam = ns.getServer(purchasedServers[0]).maxRam

  let bestServer = ""
  let minRamUsed = -1

  for ( let i = 0; i < purchasedServers.length; i++ )
  {
    const serverInfo = ns.getServer( purchasedServers[i] )

    if ( serverInfo.maxRam > lowestRam )
      break

    const usedRam = ns.getServerUsedRam( serverInfo.hostname )

    if ( minRamUsed == -1 )
    {
      bestServer = serverInfo.hostname
      minRamUsed = usedRam
    }
    else if ( usedRam < minRamUsed )
    {
      bestServer = serverInfo.hostname
      minRamUsed = usedRam
    }
  }

  return bestServer

}