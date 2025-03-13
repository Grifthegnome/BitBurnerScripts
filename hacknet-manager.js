import { KillDuplicateScriptsOnHost } from "utility.js"
import { GetReadableDateDelta } from "utility.js"

const HACKNET_INCOME_DATA_FILENAME = "hacknet_spend.txt"
const HACKNET_LEVEL_INCOME_DATA_FILENAME  = "hacknet_level_income_data.txt"
const HACKNET_RAM_INCOME_DATA_FILENAME    = "hacknet_ram_income_data.txt"
const HACKNET_CORES_INCOME_DATA_FILENAME  = "hacknet_cores_income_data.txt"

//Number of hours of income we will allow to earn a profit on our total hacknet spend.
//If we can't recoup our spend and earn a profit within this time, we will pause spending.
const HACKNET_MAX_RETURN_ON_INVEST_HOURS = 6

//How much money we are willing to invest up front, before we start to care about return on investment.
const HACKNET_INITIAL_INVESTMENT = 250000000

//The amount of money level 1 hack node generates, this can be modifed by augments over time.
const HACKNET_BASE_PRODUCTION = 0.093

const DEBUG_HACKNET_ROI_PRINTS = false

function HacknetUpgradeData( hacknetIndex, upgradeType, postUpgradeValue, roiHeuristic, upgradeCost )
{
  this.hacknetIndex     = hacknetIndex
  this.upgradeType      = upgradeType
  this.postUpgradeValue = postUpgradeValue
  this.roiHeuristic     = roiHeuristic
  this.upgradeCost      = upgradeCost
}

/** @param {NS} ns */
export async function main(ns) 
{
  //Only allow one gang manager to run at a time.
  KillDuplicateScriptsOnHost( ns, ns.getRunningScript() )

  let accountPercentage = 0.1

  if ( ns.args.length > 0 )
    accountPercentage = ns.args[0]

  const maxROIMinutes = HACKNET_MAX_RETURN_ON_INVEST_HOURS * 60
  const maxROISeconds = maxROIMinutes * 60

  //The tables have to be more complex than this, because all three values are inter-dependent for determining ROI per purchase.
  //We may be able to derrive a multiplier from the value change and store that.
  let levelIncomeData = {}
  let ramIncomeData = {}
  let coreIncomeData = {}

  /*
  //In the future we might be able to use this to build out a data table with all options to save processing power on later runs.
  if ( ns.fileExists( "formulas.exe", "home" ) )
  {
    const levelUpgradeProduction  = ns.formulas.moneyGainRate( currentLevel + 1, currentRam, currentCores )
    const ramUpgradeProduction    = ns.formulas.moneyGainRate( currentLevel, currentRam * 2, currentCores )
    const coreUpgradeProduction   = ns.formulas.moneyGainRate( currentLevel, currentRam, coreUpgradeCost + 1 )
  }
  */

  if ( ns.fileExists( HACKNET_LEVEL_INCOME_DATA_FILENAME ) )
  {
    const jsonString = ns.read( HACKNET_LEVEL_INCOME_DATA_FILENAME )
    levelIncomeData = JSON.parse( jsonString )
  }

  if ( ns.fileExists( HACKNET_RAM_INCOME_DATA_FILENAME ) )
  {
    const jsonString = ns.read( HACKNET_RAM_INCOME_DATA_FILENAME )
    ramIncomeData = JSON.parse( jsonString )
  }

  if ( ns.fileExists( HACKNET_CORES_INCOME_DATA_FILENAME ) )
  {
    const jsonString = ns.read( HACKNET_CORES_INCOME_DATA_FILENAME )
    coreIncomeData = JSON.parse( jsonString )
  }

  let totalSpend = 0
  let totalSpendLastTick = 0
  if ( ns.hacknet.numNodes() != 0 )
  {
    if ( ns.fileExists( HACKNET_INCOME_DATA_FILENAME ) )
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

    const timeToROI = ( ( totalSpend - totalIncome ) / totalIncomeRate ) * 1000

    if ( DEBUG_HACKNET_ROI_PRINTS )
      ns.tprint( "Time to ROI: " + GetReadableDateDelta( timeToROI ) )

    //We should not buy anything if our spend is greatly exceeding our production.
    if ( totalIncome > 0 )
    {
      //Basically check to see if at the end of our designated time window, we've made any money for our investement.
      if ( totalSpend > currentROIValuation && totalSpend > HACKNET_INITIAL_INVESTMENT )
      {
        continue
      }
    }

    let hacknetUpgradeArray = Array()

    for ( let i = 0; i < nodeCount; i++ )
    {
      const nodeStats = ns.hacknet.getNodeStats( i )
      const currentLevel = nodeStats.level
      const currentRam   = nodeStats.ram
      const currentCores = nodeStats.cores

      const currentProduction = nodeStats.production

      const nextLevel = currentLevel + 1
      const nextRam   = currentRam * 2
      const nextCores = currentCores + 1

      const levelUpgradeCost = ns.hacknet.getLevelUpgradeCost( i, 1 )
      const ramUpgradeCost   = ns.hacknet.getRamUpgradeCost( i, 1 )
      const coreUpgradeCost  = ns.hacknet.getCoreUpgradeCost( i, 1 )
      //const cacheUpgradeCost = ns.hacknet.getCacheUpgradeCost( i, 1 )

      let levelUpgradeProductionMultiplier  = 2//levelUpgradeCost
      let ramUpgradeProductionMultiplier    = 2//ramUpgradeCost
      let coreUpgradeProductionMultiplier   = 2//coreUpgradeCost

      if ( nextLevel in levelIncomeData )
        levelUpgradeProductionMultiplier = levelIncomeData[ nextLevel]

      if ( nextRam in ramIncomeData )
        ramUpgradeProductionMultiplier = ramIncomeData[ nextRam ]

      if ( nextCores in coreIncomeData )
        coreUpgradeProductionMultiplier = coreIncomeData[ nextCores ]

      const postLevelUpgradeProduction  = currentProduction - ( currentProduction * levelUpgradeProductionMultiplier )
      const postRamUpgradeProduction    = currentProduction - ( currentProduction * ramUpgradeProductionMultiplier )
      const postCoresUpgradeProduction  = currentProduction - ( currentProduction * coreUpgradeProductionMultiplier )

      const levelUpgradeROI = isFinite(levelUpgradeCost) ? postLevelUpgradeProduction / levelUpgradeCost : -1
      const ramUpgradeROI   = isFinite(ramUpgradeCost)   ? postRamUpgradeProduction / ramUpgradeCost : -1
      const coresUpgradeROI = isFinite(coreUpgradeCost)  ? postCoresUpgradeProduction / coreUpgradeCost : -1

      if ( levelUpgradeROI > -1 )
      {
        const levelUpgradeData = new HacknetUpgradeData( i, "level", nextLevel, levelUpgradeROI, levelUpgradeCost )
        hacknetUpgradeArray.push( levelUpgradeData )
      }
      
      if ( ramUpgradeROI > -1 )
      {
        const ramUpgradeData = new HacknetUpgradeData( i, "ram", nextRam, ramUpgradeROI, ramUpgradeCost )
        hacknetUpgradeArray.push( ramUpgradeData )
      }
      
      if ( coresUpgradeROI > -1 )
      {
        const coresUpgradeData = new HacknetUpgradeData( i, "cores", nextCores, coresUpgradeROI, coreUpgradeCost )
        hacknetUpgradeArray.push( coresUpgradeData )
      }
    }
    
    //Push a purchase upgrade onto the stack.
    if ( ns.hacknet.maxNumNodes() > nodeCount )
    {
      const nextHackNodePurchaseCost = ns.hacknet.getPurchaseNodeCost()

      const postPurchaseUpgradeProduction = HACKNET_BASE_PRODUCTION

      const purchaseUpgradeROI = isFinite(nextHackNodePurchaseCost)  ? postPurchaseUpgradeProduction / nextHackNodePurchaseCost : -1

      const purchaseUpgradeData = new HacknetUpgradeData( nodeCount - 1, "purchase", nodeCount, purchaseUpgradeROI, nextHackNodePurchaseCost )
      hacknetUpgradeArray.push( purchaseUpgradeData )

    }

    //Sort from highest to lowest return on investement.
    hacknetUpgradeArray.sort( (upgradeA, upgradeB) => upgradeB.roiHeuristic - upgradeA.roiHeuristic )

    if ( hacknetUpgradeArray.length > 0 )
    {

      const hacknetUpgrade = hacknetUpgradeArray[ 0 ]
      const nodeStats = ns.hacknet.getNodeStats( hacknetUpgrade.hacknetIndex )

      if ( hacknetUpgrade.upgradeType == "level" )
      {
        if ( isFinite( hacknetUpgrade.upgradeCost ) )
        {

          upgradesRemaining = true

          if ( hacknetUpgrade.upgradeCost <= spendFrac )
          {
            const prePurchaseProduction = nodeStats.production
            totalSpend += hacknetUpgrade.upgradeCost
            ns.hacknet.upgradeLevel( hacknetUpgrade.hacknetIndex, 1 )

            //Write upgrade info to data table so we can use it later.
            if ( !(hacknetUpgrade.postUpgradeValue in levelIncomeData) )
            {
              const postUpgradeNodeStats    = ns.hacknet.getNodeStats( hacknetUpgrade.hacknetIndex )
              const postPurchaseProduction  = postUpgradeNodeStats.production
              //const productionDelta         = postPurchaseProduction - prePurchaseProduction
              
              const upgradeProductionMultiplier = prePurchaseProduction / postPurchaseProduction

              levelIncomeData[ hacknetUpgrade.postUpgradeValue ] = upgradeProductionMultiplier

              const jsonString = JSON.stringify( levelIncomeData )
              await ns.write( HACKNET_LEVEL_INCOME_DATA_FILENAME, jsonString, "w" )
            }

            purchasedUpgrade = true
          }          
        }
      }

      if ( hacknetUpgrade.upgradeType == "ram" )
      {
        if ( isFinite( hacknetUpgrade.upgradeCost ) )
        {

          upgradesRemaining = true

          if ( hacknetUpgrade.upgradeCost <= spendFrac )
          {
            const prePurchaseProduction = nodeStats.production
            totalSpend += hacknetUpgrade.upgradeCost
            ns.hacknet.upgradeRam( hacknetUpgrade.hacknetIndex, 1 )

            //Write upgrade info to data table so we can use it later.
            if ( !(hacknetUpgrade.postUpgradeValue in ramIncomeData) )
            {
              const postUpgradeNodeStats    = ns.hacknet.getNodeStats( hacknetUpgrade.hacknetIndex )
              const postPurchaseProduction  = postUpgradeNodeStats.production
              //const productionDelta         = postPurchaseProduction - prePurchaseProduction
              
              const upgradeProductionMultiplier = prePurchaseProduction / postPurchaseProduction

              ramIncomeData[ hacknetUpgrade.postUpgradeValue ] = upgradeProductionMultiplier

              const jsonString = JSON.stringify( ramIncomeData )
              await ns.write( HACKNET_RAM_INCOME_DATA_FILENAME, jsonString, "w" )
            }

            purchasedUpgrade = true
          }
        }
      }
      
      if ( hacknetUpgrade.upgradeType == "cores" )
      {
        if ( isFinite( hacknetUpgrade.upgradeCost ) )
        {

          upgradesRemaining = true

          if ( hacknetUpgrade.upgradeCost <= spendFrac )
          {
            const prePurchaseProduction = nodeStats.production
            totalSpend += hacknetUpgrade.upgradeCost
            ns.hacknet.upgradeCore( hacknetUpgrade.hacknetIndex, 1 )

            //Write upgrade info to data table so we can use it later.
            if ( !(hacknetUpgrade.postUpgradeValue in coreIncomeData) )
            {
              const postUpgradeNodeStats    = ns.hacknet.getNodeStats( hacknetUpgrade.hacknetIndex )
              const postPurchaseProduction  = postUpgradeNodeStats.production
              //const productionDelta         = postPurchaseProduction - prePurchaseProduction
              
              const upgradeProductionMultiplier = prePurchaseProduction / postPurchaseProduction

              coreIncomeData[ hacknetUpgrade.postUpgradeValue ] = upgradeProductionMultiplier

              const jsonString = JSON.stringify( coreIncomeData )
              await ns.write( HACKNET_CORES_INCOME_DATA_FILENAME, jsonString, "w" )
            }

            purchasedUpgrade = true
          }
        }
      }

      if ( hacknetUpgrade.upgradeType == "purchase" )
      {

        upgradesRemaining = true

        if ( hacknetUpgrade.upgradeCost <= spendFrac )
        {
          totalSpend += ns.hacknet.getPurchaseNodeCost()
          const newNodeIndex = ns.hacknet.purchaseNode()
          const newNodeStats = ns.hacknet.getNodeStats( newNodeIndex )

          if ( !(newNodeStats.level in levelIncomeData) )
          {      
            levelIncomeData[ newNodeStats.level ] = 0
            const jsonString = JSON.stringify( levelIncomeData )
            await ns.write( HACKNET_LEVEL_INCOME_DATA_FILENAME, jsonString, "w" )
          }

          if ( !(newNodeStats.ram in ramIncomeData) )
          {            
            ramIncomeData[ newNodeStats.ram ] = 0
            const jsonString = JSON.stringify( ramIncomeData )
            await ns.write( HACKNET_RAM_INCOME_DATA_FILENAME, jsonString, "w" )
          }

          if ( !(newNodeStats.cores in coreIncomeData) )
          {            
            coreIncomeData[ newNodeStats.cores ] = 0
            const jsonString = JSON.stringify( coreIncomeData )
            await ns.write( HACKNET_CORES_INCOME_DATA_FILENAME, jsonString, "w" )
          }

          purchasedUpgrade = true
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