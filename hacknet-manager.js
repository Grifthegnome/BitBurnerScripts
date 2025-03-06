/** @param {NS} ns */
export async function main(ns) 
{
  let accountPercentage = 0.10

  if ( ns.args.length > 0 )
    accountPercentage = ns.args[0]

  while ( true )
  {
    await ns.sleep( 100 )

    const currentMoney = ns.getServerMoneyAvailable( "home" )
    const spendFrac = Math.floor( currentMoney * accountPercentage )

    const nodeCount = ns.hacknet.numNodes()
  
    let purchasedUpgrade = false
    let upgradesRemaining = false

    if ( ns.hacknet.maxNumNodes() > nodeCount )
    {
      if ( ns.hacknet.getPurchaseNodeCost() <= spendFrac )
      {
        ns.hacknet.purchaseNode()
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
          purchasedUpgrade = true
          break
        }          
      }
      else if ( isFinite( ramUpgradeCost ) )
      {

        upgradesRemaining = true

        if ( ramUpgradeCost <= spendFrac )
        {
          ns.hacknet.upgradeRam( i, 1 )
          purchasedUpgrade = true
          break
        }
      }
      else if ( isFinite( coreUpgradeCost ) )
      {

        upgradesRemaining = true

        if ( coreUpgradeCost <= spendFrac )
        {
          ns.hacknet.upgradeCore( i, 1 )
          purchasedUpgrade = true
          break
        }
      }
    }

    if ( !purchasedUpgrade && !upgradesRemaining )
    {
      ns.tprint( "Hack Net Nodes Fully Upgraded, Exiting Script." )
      return
    }
  }
}