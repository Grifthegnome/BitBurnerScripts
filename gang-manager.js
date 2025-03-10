function GangPriorityData( wantedWeight, respectWeight, moneyWeight, reputationWeight )
{
  this.wantedWeight       = wantedWeight
  this.respectWeight      = respectWeight
  this.moneyWeight        = moneyWeight
  this.reputationWeight   = reputationWeight
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

  let gangMemberTaskPriorityHash = {}

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

    /*
    For now, we're gonna manage a hacking gang.
    We want everyone to do ethical hacking by default.

    Depending on needs and what we can get away with, will assign the highest skill hacker
    to tasks we need them to do, always trying to keep wanted penalty low, and wanted level trending
    downward.

    We need to decide how we split between tasks that earn reputation and tasks that earn money.

    1. Recruit any new gang members we can recruit, assign them to ethical hacking.
    2. Sort our current gang members based on relevant info, we may need to sort from lowest skill to highest, so that we assign 
    easier jobs to weaker members first, then see what headroom we have for more aggressive actions.

    3. We need to determine which aggressive actions we'd like to perform, and then find the best
    member for that job.

    Notes: Before we have max members, we should prioritize respect, after we have max members,
    we should prioritize faction rep and money.

    As long as wantedLevelGainDeltaTrend is trending negative or wanted gain is below 0, we should
    be ok.

    */

    const gangPriorityData = DetermineGangPriority( currentWantedGain, wantedLevelGainDeltaTrend, moneyDeltaTrend, hasMaxMembers )

    let taskPriorityArray = Array()
    for ( let taskIndex = 0; taskIndex < taskStatsArray.length; taskIndex++ )
    {
      const taskStats = taskStatsArray[ taskIndex ]
      const taskPriorityData = DeterminePriorityForTask( gangPriorityData, taskStats, gangTaskValueBounds )
      taskPriorityArray.push( taskPriorityData )

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
    
    taskPriorityArray.sort( (taskPriorityDataA, taskPriorityDataB) => taskPriorityDataB.priority - taskPriorityDataA.priority )

    ns.tprint( "\n" )
    ns.tprint( "Wanted Level: " + gangInfo.wantedLevel )
    ns.tprint( "Wanted Gain: " + gangInfo.wantedLevelGainRate )
    ns.tprint( "Wanted Gain Trend: " + wantedLevelGainDeltaTrend )
    ns.tprint( "Wanted Penalty: " + gangInfo.wantedPenalty )
    ns.tprint( "Money Trend: " + moneyDeltaTrend )

    //return

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
      const taskStats = taskPriorityArray[taskIndex].taskStats

      let memberTaskHeuristics = Array()

      for ( let memberIndex = 0; memberIndex < memberInfoArray.length; memberIndex++ )
      {
        const memberInfo = memberInfoArray[ memberIndex ]
        const taskHeuristic = GenerateTaskHeuristicForMember( memberInfo, taskStats )

        const memberTaskHeuristic = new GangMemberTaskHeuristic( taskHeuristic, memberInfo )
        memberTaskHeuristics.push( memberTaskHeuristic )
      }

      if ( TaskIncreasesWantedLevel( taskStats ) )
        memberTaskHeuristics.sort( (memberTaskHeuristicA, memberTaskHeuristicB) => memberTaskHeuristicB.heuristic - memberTaskHeuristicA.heuristic )
      else if ( TaskReducesWantedLevel( taskStats ) )
        memberTaskHeuristics.sort( (memberTaskHeuristicA, memberTaskHeuristicB) => memberTaskHeuristicA.heuristic - memberTaskHeuristicB.heuristic )
      
      for ( let memberIndex = 0; memberIndex < memberTaskHeuristics.length && !taskAssigned; memberIndex++ )
      {
        const memberInfo = memberTaskHeuristics[memberIndex].memberInfo

        const memberTaskPriorityIndex = GetPriorityIndexForTask( taskPriorityArray, memberInfo.task )
        const targetTaskPriortiyIndex = GetPriorityIndexForTask( taskPriorityArray, taskStats.name )

        //If the member is already doing the task, skip them.
        if ( memberTaskPriorityIndex <= targetTaskPriortiyIndex )
        {
          continue
        }
        else if ( taskStats.name == "Step Down" )
        {

          debugger

          if ( memberInfo.name in gangMemberTaskPriorityHash )
          {
            const taskPriorityAtTimeOfAssignment = gangMemberTaskPriorityHash[ memberInfo.name ]

            const memberTaskPriorityIndex = GetPriorityIndexForTask( taskPriorityAtTimeOfAssignment, memberInfo.task )
          
            let currentValidTaskIndex = GetFirstIndexWithPositivePriorityFromStartIndex( taskPriorityAtTimeOfAssignment, taskPriorityAtTimeOfAssignment.length )
          
            if ( currentValidTaskIndex > memberTaskPriorityIndex )
            {
              const stepdownTaskIndex = memberTaskPriorityIndex - 1
              const taskToAssign = taskPriorityArray[stepdownTaskIndex].taskStats.name

              gangMemberTaskPriorityHash[ memberInfo.name ] = taskPriorityArray
          
              ns.gang.setMemberTask( memberInfo.name, taskToAssign )
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

          
          gangMemberTaskPriorityHash[ memberInfo.name ] = taskPriorityArray
          

          ns.gang.setMemberTask( memberInfo.name, taskToAssign )
          taskAssigned = true
          break
        }          
      }
    }

    //Handle Gang Ascension
    for ( let i = 0; i < memberInfoArray.length; i++ )
    {
      const memberInfo = memberInfoArray[i]

      const ascensionResult = ns.gang.getAscensionResult( memberInfo.name )

      if ( ascensionResult != undefined )
      {        
        AttemptGangMemberAscension( ns, memberInfo.name, ascensionResult )
      }
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

function DetermineGangPriority( wantedLevelGainRate, wantedLevelGainRateTrend, moneyTrend, hasMaxMembers )
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

  if ( wantedLevelGainRate < 0 || wantedLevelGainRateTrend < 0 )
  {
    if ( hasMaxMembers )
    {
      if ( moneyTrend > 0 )
      {
        //If we have a good wanted level, max members, and positive income, prioritize faction rep.
        wantedWeight      = 0.0
        respectWeight     = 0.0
        moneyWeight       = 0.0
        reputationWeight  = 1.0
      }
      else
      {
        //If we are losing money, prioritize getting more.
        wantedWeight      = 0.0
        respectWeight     = 0.0
        moneyWeight       = 1.0
        reputationWeight  = 0.0
      }

    }
    else
    {
      //If we don't have max members prioritize respect, so we can get them.
      wantedWeight      = 0.0
      respectWeight     = 1.0
      moneyWeight       = 0.0
      reputationWeight  = 0.0
    }
  }
  else
  {
    //Manage our wanted level.
    wantedWeight      = 1.0
    respectWeight     = 0.0
    moneyWeight       = 0.0
    reputationWeight  = 0.0
  }

  //Set priorities
    let gangPriorityData = new GangPriorityData( 
      wantedWeight, 
      respectWeight, 
      moneyWeight, 
      reputationWeight
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

function DeterminePriorityForTask( gangPriorityData, taskStats, gangTaskValueBounds )
{
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
