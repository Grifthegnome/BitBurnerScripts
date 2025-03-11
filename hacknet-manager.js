import { KillDuplicateScriptsOnHost } from "utility.js"

const HACKNET_INCOME_DATA_FILENAME = "hacknet_spend.txt"

//Number of hours of income we will allow to earn a profit on our total hacknet spend.
//If we can't recoup our spend and earn a profit within this time, we will pause spending.
const HACKNET_MAX_RETURN_ON_INVEST_HOURS = 3

/** @param {NS} ns */
export async function main(ns) 
{
  //Only allow one gang manager to run at a time.
  KillDuplicateScriptsOnHost( ns, ns.getRunningScript() )

  let accountPercentage = 0.01

  if ( ns.args.length > 0 )
    accountPercentage = ns.args[0]

  const maxROIMinutes = HACKNET_MAX_RETURN_ON_INVEST_HOURS * 60
  const maxROISeconds = maxROIMinutes * 60

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
    let totalIncomeRate = 0
    for ( let i = 0; i < nodeCount; i++ )
    {
      const nodeStats = ns.hacknet.getNodeStats( i )
      totalIncome += nodeStats.totalProduction
      totalIncomeRate += nodeStats.production
    }

    const maxROIIncomePossible = maxROISeconds * totalIncomeRate
    const currentROIValuation = totalIncome + maxROIIncomePossible

    //We should not buy anything if our spend is greatly exceeding our production.
    if ( totalIncome > 0 )
    {
      //Basically check to see if at the end of our designated time window, we've made any money for our investement.
      if ( totalSpend > currentROIValuation )
      {
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
          totalSpend += levelUpgradeCost
          ns.hacknet.upgradeLevel( i, 1 )
          purchasedUpgrade = true
          break
        }          
      }
      
      if ( isFinite( ramUpgradeCost ) )
      {

        upgradesRemaining = true

        if ( ramUpgradeCost <= spendFrac )
        {
          totalSpend += ramUpgradeCost
          ns.hacknet.upgradeRam( i, 1 )
          purchasedUpgrade = true
          break
        }
      }
      
      if ( isFinite( coreUpgradeCost ) )
      {

        upgradesRemaining = true

        if ( coreUpgradeCost <= spendFrac )
        {
          totalSpend += coreUpgradeCost
          ns.hacknet.upgradeCore( i, 1 )
          purchasedUpgrade = true
          break
        }
      }
    }

    if ( ns.hacknet.maxNumNodes() > nodeCount )
    {
      if ( ns.hacknet.getPurchaseNodeCost() <= spendFrac )
      {
        totalSpend += ns.hacknet.getPurchaseNodeCost()
        ns.hacknet.purchaseNode()
        continue
      }
    }

    if ( !purchasedUpgrade && !upgradesRemaining && ns.hacknet.maxNumNodes() <= nodeCount )
    {
      ns.tprint( "Hack Net Nodes Fully Upgraded, Exiting Script." )
      return
    }
  }
}