import { KillDuplicateScriptsOnHost } from "utility.js"

const HACKNET_INCOME_DATA_FILENAME = "hacknet_income.txt"

/** @param {NS} ns */
export async function main(ns) 
{
  //Only allow one gang manager to run at a time.
  KillDuplicateScriptsOnHost( ns, ns.getRunningScript() )

  let accountPercentage = 0.01

  if ( ns.args.length > 0 )
    accountPercentage = ns.args[0]

  //We need a way to save this out to a file and read it later.
  let totalSpend = 0
  let totalSpendLastTick = 0
  if ( ns.hacknet.numNodes() != 0 )
  {
    if ( ns.fileExists( HACKNET_INCOME_DATA_FILENAME, ns.getHostname() ) )
    {
      const fileContent = Number( ns.read( HACKNET_INCOME_DATA_FILENAME ) )
      totalSpend = fileContent
    }
    else
    {
      await ns.write( HACKNET_INCOME_DATA_FILENAME, 0, "w" )
    }
  }
  else
  {
    await ns.write( HACKNET_INCOME_DATA_FILENAME, 0, "w" )
  }
  
  totalSpendLastTick = totalSpend

  while ( true )
  {    
    if ( totalSpend != totalSpendLastTick )
    {
      await ns.write( HACKNET_INCOME_DATA_FILENAME, totalSpend, "w" )
      totalSpendLastTick = totalSpend
    }
    
    await ns.sleep( 100 )

    const currentMoney = ns.getServerMoneyAvailable( "home" )
    const spendFrac = Math.floor( currentMoney * accountPercentage )

    const nodeCount = ns.hacknet.numNodes()
  
    let purchasedUpgrade = false
    let upgradesRemaining = false

    let totalIncome = 0
    for ( let i = 0; i < nodeCount; i++ )
    {
      const nodeStats = ns.hacknet.getNodeStats( i )
      totalIncome += nodeStats.totalProduction
    }

    //We should not buy anything if our spend is greatly exceeding our production.
    if ( totalIncome > 0 )
    {
      if ( totalSpend * 0.8 > totalIncome )
      {
        continue
      }
    }

    if ( ns.hacknet.maxNumNodes() > nodeCount )
    {
      if ( ns.hacknet.getPurchaseNodeCost() <= spendFrac )
      {
        ns.hacknet.purchaseNode()
        totalSpend += ns.hacknet.getPurchaseNodeCost()
        continue
      }
    }

    for ( let i = 0; i < nodeCount; i++ )
    {
      const levelUpgradeCost = ns.hacknet.getLevelUpgradeCost( i, 1 )
      const ramUpgradeCost   = ns.hacknet.getRamUpgradeCost( i, 1 )
      const coreUpgradeCost  = ns.hacknet.getCoreUpgradeCost( i, 1 )
      //const cacheUpgradeCost = ns.hacknet.getCacheUpgradeCost( i, 1 )

      if ( isFinite( levelUpgradeCost ) )
      {

        upgradesRemaining = true

        if ( levelUpgradeCost <= spendFrac )
        {
          ns.hacknet.upgradeLevel( i, 1 )
          totalSpend += levelUpgradeCost
          purchasedUpgrade = true
          break
        }          
      }
      
      if ( isFinite( ramUpgradeCost ) )
      {

        upgradesRemaining = true

        if ( ramUpgradeCost <= spendFrac )
        {
          ns.hacknet.upgradeRam( i, 1 )
          totalSpend += ramUpgradeCost
          purchasedUpgrade = true
          break
        }
      }
      
      if ( isFinite( coreUpgradeCost ) )
      {

        upgradesRemaining = true

        if ( coreUpgradeCost <= spendFrac )
        {
          ns.hacknet.upgradeCore( i, 1 )
          totalSpend += coreUpgradeCost
          purchasedUpgrade = true
          break
        }
      }
    }

    if ( !purchasedUpgrade && !upgradesRemaining && ns.hacknet.maxNumNodes() <= nodeCount )
    {
      ns.tprint( "Hack Net Nodes Fully Upgraded, Exiting Script." )
      return
    }
  }
}