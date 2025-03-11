import { KillDuplicateScriptsOnHost } from "utility.js"

function GangPriorityData( wantedWeight, respectWeight, moneyWeight, reputationWeight, warfareWeight )
{
  this.wantedWeight       = wantedWeight
  this.respectWeight      = respectWeight
  this.moneyWeight        = moneyWeight
  this.reputationWeight   = reputationWeight
  this.warfareWeight      = warfareWeight
}

function GangTaskPriorityData( taskStats, priority )
{
  this.taskStats = taskStats
  this.priority = priority
}

function GangTaskValueBounds( highestWanted, highestRespect, highestMoney, highestDifficulty )
{
  this.highestWanted      = highestWanted
  this.highestRespect     = highestRespect
  this.highestMoney       = highestMoney
  this.highestDifficulty  = highestDifficulty
}

function GangMemberTaskHeuristic( heuristic, memberInfo )
{
  this.heuristic  = heuristic
  this.memberInfo = memberInfo
}

function GangEquipmentData( name, stats, tags )
{
  this.name     = name
  this.stats    = stats
  this.tags     = tags

  const statKeys = Object.keys( stats )

  let statTotal = 0
  for ( let i = 0; i < statKeys.length; i++ )
  {
    const key = statKeys[i]
    statTotal += stats[key]
  }

  this.upgradeValue = statTotal
}

const GANG_MEMBER_EQUIPMENT_UPGRADE_MAX_ACCOUNT_SPEND_FRAC = 0.01
const GANG_MEMBER_STEPDOWN_DBOUNCE = 60000
const DEBUG_PRINT_GANG_MANAGER = false

/** @param {NS} ns */
export async function main(ns) 
{
  //gang.recruitMember()
  const DEFAULT_HACKING_TASK  = "Ethical Hacking"
  const DEFAULT_COMBAT_TASK   = "Vigilante Justice"
  const GANG_MEMBER_NAME      = " Ganger "

  if ( !ns.gang.inGang )
  {
    ns.tprint( "You are not in a gang, join a gang before running this script." )
    ns.tprint( "Ending script." )
    return
  }

  let idealPriority = "money"
  if ( ns.args.length > 0 )
    idealPriority = ns.args[0]

  if ( idealPriority != "money" && idealPriority != "faction" && idealPriority != "warfare" )
  {
    ns.tprint( "Gang priority must be money or faction, " + idealPriority + " is an invalid option." )
    ns.tprint( "Ending script." )
    return
  }

  //Only allow one gang manager to run at a time.
  KillDuplicateScriptsOnHost( ns, ns.getRunningScript() )

  let lastWantedLevelGain       = -1.0
  let currentWantedGain         = 0.0
  let wantedLevelGainDeltaTrend = 0.0

  let lastMoneyAvailable    = 0.0
  let currentMoneyAvailable = 0.0
  let moneyDeltaTrend       = 0.0

  let firstFrame = true

  const tasks = ns.gang.getTaskNames()
  let taskStatsArray = Array()
  for ( let taskIndex = 0; taskIndex < tasks.length; taskIndex++ )
  {
     const task = tasks[ taskIndex ]
     const taskStats = ns.gang.getTaskStats( task )
     taskStatsArray.push( taskStats )
  }

  const gangTaskValueBounds = DetermineGangTaskValueBounds( taskStatsArray )
  const equipmentTableHash = BuildGangEquipmentTables( ns )

  let gangMemberTaskPriorityHash = {}
  let gangMemberPreviousTaskHash = {}
  let gangMemberLastStepDownTimeHash = {}
  let lastGangMemberAssignedTask = ""

  while( true )
  {
    const gangInfo = ns.gang.getGangInformation()

    currentWantedGain = gangInfo.wantedLevelGainRate
    currentMoneyAvailable = ns.getServerMoneyAvailable( "home" )

    if ( firstFrame )
    {
      lastWantedLevelGain = currentWantedGain
      lastMoneyAvailable  = currentMoneyAvailable
      firstFrame = false
    }

    const wantedLevelGainDelta  = currentWantedGain - lastWantedLevelGain
    wantedLevelGainDeltaTrend   = ( wantedLevelGainDeltaTrend + wantedLevelGainDelta ) / 2

    const moneyDelta = currentMoneyAvailable - lastMoneyAvailable
    moneyDeltaTrend = ( moneyDeltaTrend + moneyDelta ) / 2

    let memberNames = ns.gang.getMemberNames()

    const nextRecruitRespectLevel = ns.gang.respectForNextRecruit()
    const hasMaxMembers = !isFinite( nextRecruitRespectLevel )

    if ( !hasMaxMembers )
    {
      const availableRecruits = ns.gang.getRecruitsAvailable()
      if ( availableRecruits > 0 )
      {
        for ( let i = 0; i < availableRecruits; i++ )
        {
          const newMemberName = gangInfo.faction + GANG_MEMBER_NAME + memberNames.length
          if ( ns.gang.recruitMember( newMemberName ) )
          {

            ns.tprint( "Recruiting Member: " + newMemberName )

            //We are manually pushing new recruits into the name array to save ram.
            memberNames.push( newMemberName )

            if ( ns.gang.isHacking )
              ns.gang.setMemberTask( newMemberName, DEFAULT_HACKING_TASK )
            else if ( ns.gang.isCombat )
              ns.gang.setMemberTask( newMemberName, DEFAULT_COMBAT_TASK )
          }
        }
      }
    }

    const gangPriorityData = DetermineGangPriority( idealPriority, currentWantedGain, wantedLevelGainDeltaTrend, moneyDeltaTrend, hasMaxMembers )

    let taskPriorityArray = Array()
    for ( let taskIndex = 0; taskIndex < taskStatsArray.length; taskIndex++ )
    {
      const taskStats = taskStatsArray[ taskIndex ]
      const taskPriorityData = DeterminePriorityForTask( gangPriorityData, taskStats, gangTaskValueBounds, gangInfo.territoryWarfareEngaged )
      taskPriorityArray.push( taskPriorityData )

      if ( DEBUG_PRINT_GANG_MANAGER )
      {
        ns.tprint( "\n" )
        ns.tprint( taskStats.name )
        ns.tprint( "Base Money: " + taskStats.baseMoney )
        ns.tprint( "Base Respect: " + taskStats.baseRespect )
        ns.tprint( "Base Wanted: " + taskStats.baseWanted )
        ns.tprint( "Difficulty: " + taskStats.difficulty )

        ns.tprint( "Hack Weight: " + taskStats.hackWeight )
        ns.tprint( "Str Weight: " + taskStats.strWeight )
        ns.tprint( "Def Weight: " + taskStats.defWeight )
        ns.tprint( "Dex Weight: " + taskStats.dexWeight )
        ns.tprint( "Agi Weight: " + taskStats.agiWeight )
        ns.tprint( "Cha Weight: " + taskStats.chaWeight )

        ns.tprint( "Is Hacking: " + taskStats.isHacking )
        ns.tprint( "Is Combat: " + taskStats.isCombat )
      }
    }
    
    taskPriorityArray.sort( (taskPriorityDataA, taskPriorityDataB) => taskPriorityDataB.priority - taskPriorityDataA.priority )

    if ( DEBUG_PRINT_GANG_MANAGER )
    {
      ns.tprint( "\n" )
      ns.tprint( "Wanted Level: " + gangInfo.wantedLevel )
      ns.tprint( "Wanted Gain: " + gangInfo.wantedLevelGainRate )
      ns.tprint( "Wanted Gain Trend: " + wantedLevelGainDeltaTrend )
      ns.tprint( "Wanted Penalty: " + gangInfo.wantedPenalty )
      ns.tprint( "Money Trend: " + moneyDeltaTrend )
    } 

    let memberInfoArray = Array()

    for ( let i = 0; i < memberNames.length; i++ )
    {
      const memberInfo = ns.gang.getMemberInformation( memberNames[i] )
      memberInfoArray.push( memberInfo )    
    }

    //We need to sort by diffrent criteria depending on the task.

    memberInfoArray.sort( (memberInfoA, memberInfoB ) => memberInfoA.hack - memberInfoB.hack )

    let taskAssigned = false
    for ( let taskIndex = 0; taskIndex < taskPriorityArray.length && !taskAssigned; taskIndex++ )
    {
      const targetTaskStats = taskPriorityArray[taskIndex].taskStats

      let memberTaskHeuristics = Array()

      for ( let memberIndex = 0; memberIndex < memberInfoArray.length; memberIndex++ )
      {
        const memberInfo = memberInfoArray[ memberIndex ]
        const taskHeuristic = GenerateTaskHeuristicForMember( memberInfo, targetTaskStats )

        const memberTaskHeuristic = new GangMemberTaskHeuristic( taskHeuristic, memberInfo )
        memberTaskHeuristics.push( memberTaskHeuristic )
      }

      if ( TaskIncreasesWantedLevel( targetTaskStats ) )
        memberTaskHeuristics.sort( (memberTaskHeuristicA, memberTaskHeuristicB) => memberTaskHeuristicB.heuristic - memberTaskHeuristicA.heuristic )
      else if ( TaskReducesWantedLevel( targetTaskStats ) )
        memberTaskHeuristics.sort( (memberTaskHeuristicA, memberTaskHeuristicB) => memberTaskHeuristicA.heuristic - memberTaskHeuristicB.heuristic )
      
      //We need to cover the case where no task change is needed.
      const warfareMode = ( idealPriority == "warfare" && gangInfo.territoryWarfareEngaged )
      for ( let memberIndex = 0; memberIndex < memberTaskHeuristics.length && ( !taskAssigned && !warfareMode ); memberIndex++ )
      {
        const memberInfo = memberTaskHeuristics[memberIndex].memberInfo

        const memberTaskPriorityIndex = GetPriorityIndexForTask( taskPriorityArray, memberInfo.task )
        const targetTaskPriortiyIndex = GetPriorityIndexForTask( taskPriorityArray, targetTaskStats.name )

        //This is to handle the case where going from an agressive task, to a slightly less agressive task lowers our wanted level enough to balance things out.
        let stepDownCurrentTask = false
        if ( memberInfo.name == lastGangMemberAssignedTask )
        {
          if ( memberInfo.name in gangMemberTaskPriorityHash )
          {
            const taskPriorityAtTimeOfAssignment = gangMemberTaskPriorityHash[ memberInfo.name ]
            const currentTaskIndex = GetPriorityIndexForTask( taskPriorityAtTimeOfAssignment, memberInfo.task )
            const currentTaskStats = taskPriorityAtTimeOfAssignment[ currentTaskIndex ].taskStats
            
            //If we need to do a task that decreases wanted level, but we are doing a task that increases wanted level.
            if ( TaskReducesWantedLevel( targetTaskStats ) && TaskIncreasesWantedLevel( currentTaskStats ) )
            {
              stepDownCurrentTask = true
            }
          }          
        }

        let nextStepDownTime = 0
        if ( memberInfo.name in gangMemberLastStepDownTimeHash )
        {
          const lastStepDownTime = gangMemberLastStepDownTimeHash[ memberInfo.name ]
          nextStepDownTime = lastStepDownTime + GANG_MEMBER_STEPDOWN_DBOUNCE
        }

        //If the member is already doing the task, skip them.
        if ( memberTaskPriorityIndex <= targetTaskPriortiyIndex || nextStepDownTime > Date.now() )
        {
          continue
        }
        else if ( stepDownCurrentTask )
        {
          if ( memberInfo.name in gangMemberTaskPriorityHash )
          {
            const taskPriorityAtTimeOfAssignment = gangMemberTaskPriorityHash[ memberInfo.name ]

            const memberTaskPriorityIndex = GetPriorityIndexForTask( taskPriorityAtTimeOfAssignment, memberInfo.task )
          
            let currentValidTaskIndex = GetFirstIndexWithPositivePriorityFromStartIndex( taskPriorityAtTimeOfAssignment, taskPriorityAtTimeOfAssignment.length - 1 )
          
            //Step down to lower wanted level task if there are tasks to step down to.
            if ( currentValidTaskIndex > memberTaskPriorityIndex )
            {
              const stepdownTaskIndex = memberTaskPriorityIndex + 1
              const taskToAssign = taskPriorityAtTimeOfAssignment[stepdownTaskIndex].taskStats.name

              gangMemberPreviousTaskHash[ memberInfo.name ] = memberInfo.task
              gangMemberTaskPriorityHash[ memberInfo.name ] = taskPriorityAtTimeOfAssignment
              gangMemberLastStepDownTimeHash[ memberInfo.name ] = Date.now()
          
              ns.gang.setMemberTask( memberInfo.name, taskToAssign )
              lastGangMemberAssignedTask    = memberInfo.name
              
              taskAssigned = true
              break
            }
            //If there are no tasks in the priority hiarchy for us to step down to, revert to gang member's previous task.
            else if ( memberInfo.name in gangMemberPreviousTaskHash )
            {              
              const previousTaskName = gangMemberPreviousTaskHash[ memberInfo.name ]

              gangMemberPreviousTaskHash[ memberInfo.name ] = memberInfo.task

              //This is not the correct task priority entry for the previous task, but rather the current task, will this cause issues?
              gangMemberTaskPriorityHash[ memberInfo.name ] = taskPriorityAtTimeOfAssignment
              gangMemberLastStepDownTimeHash[ memberInfo.name ] = Date.now()
          
              ns.gang.setMemberTask( memberInfo.name, previousTaskName )
              lastGangMemberAssignedTask    = memberInfo.name
              
              taskAssigned = true
              break
            }
          }
        }
        else
        {
          
          let currentValidTaskIndex = GetFirstIndexWithPositivePriorityFromStartIndex( taskPriorityArray, memberTaskPriorityIndex )
          
          //We may need to make sure this doesn't go below 0
          if ( currentValidTaskIndex == memberTaskPriorityIndex )
            currentValidTaskIndex--

          if ( currentValidTaskIndex < 0 )
            debugger

          const taskToAssign = taskPriorityArray[currentValidTaskIndex].taskStats.name

          gangMemberPreviousTaskHash[ memberInfo.name ] = memberInfo.task
          gangMemberTaskPriorityHash[ memberInfo.name ] = taskPriorityArray
          

          ns.gang.setMemberTask( memberInfo.name, taskToAssign )
          lastGangMemberAssignedTask = memberInfo.name
          taskAssigned = true
          break
        }          
      }
    }

    //Handle Gang Ascension
    if ( !gangInfo.territoryWarfareEngaged ) 
    {
      for ( let i = 0; i < memberInfoArray.length; i++ )
      {
        const memberInfo = memberInfoArray[i]
        const ascensionResult = ns.gang.getAscensionResult( memberInfo.name )
        if ( ascensionResult != undefined )
        {
          //Only ascend one gang member per gang tick.
          AttemptGangMemberAscension( ns, memberInfo.name, ascensionResult )
          break
        }
      }
    }
    
    const prioritizedEquipmentPurchaseList = PrioritizeEquipmentPurchaseTable( equipmentTableHash, gangInfo.territoryWarfareEngaged )

    //Note: All non-augment upgrades are lost when gang member ascends, factor this into spend.

    //Note: Currently, whether the weakest gang members get gear upgrades first or the best get gear first depends on if the gang is prioritizing hostile actions or wanted reduction.

    //Handle Gang Upgrades
    for ( let i = 0; i < memberInfoArray.length; i++ )
    {
      const memberInfo = memberInfoArray[i]
      AttemptGangMemberUpgrade( ns, memberInfo, prioritizedEquipmentPurchaseList )
    }
    
    lastWantedLevelGain = currentWantedGain
    lastMoneyAvailable = currentMoneyAvailable

    await ns.sleep( 2000 )
  }

}

function AttemptGangMemberAscension( ns, memberName, ascensionResult )
{
  
  const ascensionThreshold = 1 / 3

  let shouldAscend = false

  if ( ascensionResult.hack - 1 >= ascensionThreshold )
    shouldAscend = true
  else if ( ascensionResult.str - 1 >= ascensionThreshold )
    shouldAscend = true
  else if ( ascensionResult.def - 1 >= ascensionThreshold )
    shouldAscend = true
  else if ( ascensionResult.dex - 1 >= ascensionThreshold )
    shouldAscend = true
  else if ( ascensionResult.agi - 1 >= ascensionThreshold )
    shouldAscend = true
  else if ( ascensionResult.cha - 1 >= ascensionThreshold )
    shouldAscend = true

  if ( shouldAscend )
  {
    ns.tprint( "Ascending Member " + memberName )
    ns.gang.ascendMember( memberName )
  }
}

function BuildGangEquipmentTables( ns )
{
  let equipmentTableHash = {}
  const equipmentNames = ns.gang.getEquipmentNames()

  for ( let i = 0; i < equipmentNames.length; i++ )
  {
    const equipmentName = equipmentNames[i]
    const equipmentType = ns.gang.getEquipmentType( equipmentName )
    const equipmentStats = ns.gang.getEquipmentStats( equipmentName )

    if ( equipmentType in equipmentTableHash )
    {
      const equipmentTags = DetermineEquipmentTags( equipmentStats )
      const equipmentEntry = new GangEquipmentData( equipmentName, equipmentStats, equipmentTags )
      equipmentTableHash[equipmentType].push( equipmentEntry )
    }
    else
    {
      const equipmentTags = DetermineEquipmentTags( equipmentStats )
      const equipmentEntry = new GangEquipmentData( equipmentName, equipmentStats, equipmentTags )
      let equipmentTypeArray = Array( equipmentEntry )
      equipmentTableHash[equipmentType] = equipmentTypeArray
    }
  }  

  return equipmentTableHash

}

function DetermineEquipmentTags( equipmentStats )
{
  let tags = Array()

  if ( "str" in equipmentStats || "def" in equipmentStats || "dex" in equipmentStats || "agi" in equipmentStats )
    tags.push( "combat" )

  if ( "hack" in equipmentStats || "cha" in equipmentStats )
    tags.push( "hacking" ) 

  return tags
}

function PrioritizeEquipmentPurchaseTable( equipmentTableHash, territoryWarfareEngaged )
{
  /*
    if we are engaged in territory warfare, buy combat augments, weapons, armor first, otherwise focus on hacking gear.

    Prioritize augments first, because they persist through ascention.

    We should prioritize equipment that gives more buffs over lower buffs.
  */

  let equipmentCategoryOrder
  let equipmentTagOrder
  if ( territoryWarfareEngaged )
  {
    equipmentCategoryOrder = [ "Augmentation", "Weapon", "Armor", "Vehicle", "Rootkit" ]
    equipmentTagOrder = [ "combat", "hacking" ]
  }
  else
  {
    equipmentCategoryOrder = [ "Augmentation", "Rootkit", "Vehicle", "Weapon", "Armor" ]
    equipmentTagOrder = [ "hacking", "combat" ]
  }
    
  let masterHackingEquipmentList  = Array()
  let masterCombatEquipmentList   = Array()

  for ( let i = 0; i < equipmentCategoryOrder.length; i++ )
  {
    const currentCategory     = equipmentCategoryOrder[i]
    const equipmentInCategory = equipmentTableHash[ currentCategory ]

    let localHackingEquipmentList = Array()
    let localCombatEquipmentList  = Array()

    for ( let j = 0; j < equipmentInCategory.length; j++ )
    {
      const equipmentEntry = equipmentInCategory[j]

      for ( let tagIndex = 0; tagIndex < equipmentTagOrder.length; tagIndex++ )
      {
        const currentTag = equipmentTagOrder[tagIndex]

        if ( equipmentEntry.tags.includes( currentTag ) )
        {
          if ( currentTag == "hacking" )
          {
            localHackingEquipmentList.push( equipmentEntry )
            break
          }
          else if ( currentTag == "combat" )
          {
            localCombatEquipmentList.push( equipmentEntry )
            break
          }
        }
      }
    }

    localHackingEquipmentList.sort( (entryA, entryB) => entryB.upgradeValue - entryA.upgradeValue )
    localCombatEquipmentList.sort( (entryA, entryB) => entryB.upgradeValue - entryA.upgradeValue )

    for ( let tagIndex = 0; tagIndex < equipmentTagOrder.length; tagIndex++ )
    {
      const currentTag = equipmentTagOrder[tagIndex]
      if ( currentTag == "hacking" )
        masterHackingEquipmentList = masterHackingEquipmentList.concat( localHackingEquipmentList )
      else if ( currentTag == "combat" )
        masterCombatEquipmentList = masterCombatEquipmentList.concat( localCombatEquipmentList )
    }
  }

  let finalEquipmentList = Array()
  for ( let tagIndex = 0; tagIndex < equipmentTagOrder.length; tagIndex++ )
  {
    const currentTag = equipmentTagOrder[tagIndex]
    if ( currentTag == "hacking" )
    {
      finalEquipmentList = masterHackingEquipmentList.concat( masterCombatEquipmentList )
      break
    }
    else if ( currentTag == "combat" )
    {
      finalEquipmentList = masterCombatEquipmentList.concat( masterHackingEquipmentList )
      break
    } 
  }

  return finalEquipmentList

}

function AttemptGangMemberUpgrade( ns, memberInfo, upgradeList )
{
  const maxSpend = Math.floor( ns.getServerMoneyAvailable( "home" ) * GANG_MEMBER_EQUIPMENT_UPGRADE_MAX_ACCOUNT_SPEND_FRAC )

  //gangInfo.territoryWarfareEngaged
  const memberAugmentations = memberInfo.augmentations

  for ( let i = 0; i < upgradeList.length; i++ )
  {
    const potentialUpgrade = upgradeList[i]

    if ( memberAugmentations.includes( potentialUpgrade.name ) )
      continue

    if ( ns.gang.getEquipmentCost( potentialUpgrade.name ) <= maxSpend )
    {
      if ( ns.gang.purchaseEquipment( memberInfo.name, potentialUpgrade.name ) )
      {
        ns.tprint( "Purchased " + potentialUpgrade.name + " for " + memberInfo.name )
        //Purchase Sucessful.
        return true
      }
    }
  }

  //Nothing we can currently buy
  return false
}

function GenerateTaskHeuristicForMember( memberInfo, taskStats )
{
  const hackWeight = taskStats.hackWeight / 100
  const strWeight = taskStats.strWeight / 100
  const defWeight = taskStats.defWeight / 100
  const dexWeight = taskStats.dexWeight / 100
  const agiWeight = taskStats.agiWeight / 100
  const chaWeight = taskStats.chaWeight / 100

  if ( hackWeight + strWeight + defWeight + dexWeight + agiWeight + chaWeight != 1.0 )
    debugger

  const weightedHack = memberInfo.hack  * hackWeight
  const weightedStr  = memberInfo.str   * strWeight
  const weightedDef  = memberInfo.def   * defWeight
  const weightedDex  = memberInfo.dex   * dexWeight
  const weightedAgi  = memberInfo.agi   * agiWeight
  const weightedCha  = memberInfo.cha   * chaWeight

  const abilityTotal = ( weightedHack + weightedStr + weightedDef + weightedDex + weightedAgi * weightedCha ) / taskStats.difficulty

  return abilityTotal

}

function DetermineGangPriority( idealPriority, wantedLevelGainRate, wantedLevelGainRateTrend, moneyTrend, hasMaxMembers )
{
  /*
    1# always keep wanted level trending negative.
    2# get respect until gang is full sized.
    3# if money is trending negative, prioritize earning money.
    4# if everything else is good, farm faction reputation.
  */

  let wantedWeight      = 0.0
  let respectWeight     = 0.0
  let moneyWeight       = 0.0
  let reputationWeight  = 0.0
  let warfareWeight     = 0.0

  if ( idealPriority == "warfare" )
  {
    wantedWeight      = 0.0
    respectWeight     = 0.0
    moneyWeight       = 0.0
    reputationWeight  = 0.0
    warfareWeight     = 1.0
  }
  else
  {
    if ( wantedLevelGainRate < 0 || wantedLevelGainRateTrend < 0 )
    {
      if ( hasMaxMembers )
      {
        if ( moneyTrend > 0 && idealPriority == "faction" )
        {
          //This is our target if idealPriority is faction.
          //If we have a good wanted level, max members, and positive income, prioritize faction rep.
          wantedWeight      = 0.0
          respectWeight     = 0.0
          moneyWeight       = 0.0
          reputationWeight  = 1.0
          warfareWeight     = 0.0
        }
        else
        {
          //This is our target if idealPriority is money.
          //If we are losing money, prioritize getting more.
          wantedWeight      = 0.0
          respectWeight     = 0.0
          moneyWeight       = 1.0
          reputationWeight  = 0.0
          warfareWeight     = 0.0
        }

      }
      else
      {
        //If we don't have max members prioritize respect, so we can get them.
        wantedWeight      = 0.0
        respectWeight     = 1.0
        moneyWeight       = 0.0
        reputationWeight  = 0.0
        warfareWeight     = 0.0
      }
    }
    else
    {
      //Manage our wanted level.
      wantedWeight      = 1.0
      respectWeight     = 0.0
      moneyWeight       = 0.0
      reputationWeight  = 0.0
      warfareWeight     = 0.0
    }
  }
  

  //Set priorities
    let gangPriorityData = new GangPriorityData( 
      wantedWeight, 
      respectWeight, 
      moneyWeight, 
      reputationWeight,
      warfareWeight
      )

  return gangPriorityData
}

function DetermineGangTaskValueBounds( taskStatsArray )
{
  let highestWanted     = 0
  let highestRespect    = 0
  let highestMoney      = 0
  let highestDifficulty = 0

  for ( let i = 0; i < taskStatsArray.length; i++ )
  {
    const taskStats = taskStatsArray[i]

    if ( taskStats.baseWanted > highestWanted )
      highestWanted = taskStats.baseWanted
    
    if ( taskStats.baseRespect > highestRespect )
      highestRespect = taskStats.baseRespect

    if ( taskStats.baseMoney > highestMoney )
      highestMoney = taskStats.baseMoney
    
    if ( taskStats.difficulty > highestDifficulty )
      highestDifficulty = taskStats.difficulty 
  }

  const gangTaskValueBounds = new GangTaskValueBounds( 
    highestWanted, 
    highestRespect, 
    highestMoney,
    highestDifficulty
    )

  return gangTaskValueBounds
}

function DeterminePriorityForTask( gangPriorityData, taskStats, gangTaskValueBounds, territoryWarfareEngaged )
{

  //Gang warfare takes special priority.
  if ( gangPriorityData.warfareWeight > 0 )
  {
    if ( territoryWarfareEngaged )
    {
      if ( taskStats.name == "Territory Warfare" )
        return new GangTaskPriorityData( taskStats, 1.0 )
      else
        return new GangTaskPriorityData( taskStats, 0.0 )
    }
    else
    {
      if ( taskStats.name == "Train Combat" )
        return new GangTaskPriorityData( taskStats, 1.0 )
      else
        return new GangTaskPriorityData( taskStats, 0.0 )
    }
  }

  const normalizedWanted      = ( taskStats.baseWanted / gangTaskValueBounds.highestWanted )
  const normalizedRespect     = ( taskStats.baseRespect / gangTaskValueBounds.highestRespect )
  const normalizedMoney       = ( taskStats.baseMoney / gangTaskValueBounds.highestMoney )
  const normalizedDifficulty  = ( taskStats.difficulty / gangTaskValueBounds.highestDifficulty )

  const wantedFactor  = gangPriorityData.wantedWeight   * normalizedWanted
  const respectFactor = gangPriorityData.respectWeight  * normalizedRespect
  const moneyFactor   = gangPriorityData.moneyWeight    * normalizedMoney

  //I'm not sure how we figure out faction respect return from each task. It seems related to money and reputation of a task.
  const reputationFactor = normalizedRespect > 0 ? gangPriorityData.reputationWeight * ( ( normalizedRespect + normalizedDifficulty ) / 2 ) : 0.0
  const priority = ( ( respectFactor + moneyFactor + reputationFactor ) - wantedFactor )

  const taskPriorityData = new GangTaskPriorityData( taskStats, priority )
  return taskPriorityData
}

function GetPriorityIndexForTask( taskPriorityArray, taskName )
{
  for ( let i = 0; i < taskPriorityArray.length; i++ )
  {
    const taskStats = taskPriorityArray[i].taskStats

    if ( taskStats.name == taskName )
      return i

  }

  return -1

}

function GetFirstIndexWithPositivePriorityFromStartIndex( taskPriorityArray, startIndex )
{
  for ( let i = startIndex; i >= 0; i-- )
  {
    const priority = taskPriorityArray[i].priority

    if ( priority > 0 )
      return i

  }

  return -1
}

function TaskReducesWantedLevel( taskStats )
{
  return taskStats.baseWanted < 0
}

function TaskIncreasesWantedLevel( taskStats )
{
  return taskStats.baseWanted > 0
}
