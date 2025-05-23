import { KillDuplicateScriptsOnHost } from "utility.js"
import { AddCommasToNumber } from "utility.js"
import { GetReadableDateDelta } from "utility.js"

const BLADEBURNER_LAST_INTEL_TIME_FILENAME = "bladeburner_intel_time.txt"
const BLADEBURNER_LAST_CITY_POP_FILENAME = "bladeburner_last_city_pop.txt"
const BLADEBURNER_CITY_POP_TREND_FILENAME = "bladeburner_city_pop_trend.txt"
const BLADEBURNER_ACTION_SUCCESS_RATES_BY_CITY_FILENAME = "bladeburner_city_success_rates.txt"
const BLADEBURNER_REPORT_FILENAME = "bladeburner_report.txt"

const BLADEBURNER_ACCEPTABLE_POP_LEVEL = 1000000000
const BLADEBURNER_AGGRESSIVE_CONTROL_POP_LEVEL = 1500000000

const BLADEBURNER_PAY_FOR_HOSPITAL_THRESHHOLD = 50000000

const BLADEBURNER_RECRUIT_SUCCESS_THRESHOLD = 0.3666666

//Every 20 minutes update intel.
const BLADEBURNER_INTEL_INTERVAL = (1000 * 60) * 20
const BLADEBURNER_INTEL_CYCLES_PER_CITY = 5

const BLADEBURNER_INTEL_MIN_ACCEPTABLE_SUCCESS_CHANCE = 1.0
const BLADEBURNER_CONTRACT_MIN_ACCEPTABLE_SUCCESS_CHANCE = 0.5
const BLADEBURNER_OPERATION_MIN_ACCEPTABLE_SUCCESS_CHANCE = 0.8
const BLADEBURNER_BLACKOPS_MIN_ACCEPTABLE_SUCCESS_CHANCE = 1.0

const cityNames = [ "Aevum", "Chongqing", "Sector-12", "New Tokyo", "Ishima", "Volhaven" ]

const eBladeburnerStates = Object.freeze({
  DOWNTIME: 0,
  CHAOS_CONTROL: 1,
  POP_CONTROL:2,
  GATHER_INTEL: 3,
  HEAL: 4,
  BLACKOPS: 5,
} )

const eBladeburnerActionTypes = Object.freeze({
  GENERAL: "General",
  CONTRACTS: "Contracts",
  OPERATIONS: "Operations",
  BLACKOPS: "Black Operations",
})

const eBladeburnerGeneralActions = Object.freeze({
  TRAIN: "Training",
  INTEL: "Field Analysis",
  RECRUIT: "Recruitment",
  DIPLOMACY: "Diplomacy",
  HEAL: "Hyperbolic Regeneration Chamber",
  VIOLENCE: "Incite Violence",
})

const eBladeburnerContractActions = Object.freeze({
  TRACK: "Tracking",
  CAPTURE: "Bounty Hunter",
  KILL: "Retirement", 
})

const eBladeburnerOperationActions = Object.freeze({
  INVESTIGATE: "Investigation",
  UNDERCOVER: "Undercover Operation",
  STING: "Sting Operation",                       //PERCENT REDUCTION
  RAID: "Raid",                                   //PERCENT REDUCTION
  STEALTH_KILL: "Stealth Retirement Operation",   //PERCENT REDUCTION
  ASSASSINATION: "Assassination",                 //PERCENT REDUCTION
})

//If we are dealing with large uncontrolled synth populations, configure for combating and controling population.
const eBladeburnerSkillCategoryPriorityForControl = Object.freeze({
  ACTION_SUCCESS: ["Blade's Intuition", "Cloak", "Short-Circuit","Tracer","Digital Observer", "Reaper", "Evasive System" ],
  ACTION_SPEED:   ["Overclock"],
  INTEL_GAIN:     ["Datamancer"],
  EXP_GAIN:       ["Hyperdrive"],
  MONEY_GAIN:     ["Hands of Midas"],
  STAMINA:        ["Cyber's Edge"],
})

//If we don't have to worry about any large synth populations, configure for bounty farming effectiveness.
const eBladeburnerSkillCategoryPriorityForFarming = Object.freeze({
  MONEY_GAIN:     ["Hands of Midas"],
  ACTION_SPEED:   ["Overclock"],
  EXP_GAIN:       ["Hyperdrive"],
  STAMINA:        ["Cyber's Edge"],
  INTEL_GAIN:     ["Datamancer"],
  ACTION_SUCCESS: ["Blade's Intuition", "Cloak", "Short-Circuit","Tracer","Digital Observer", "Reaper", "Evasive System" ],  
})

/** @param {NS} ns */
export async function main(ns) 
{
  //Only allow one gang manager to run at a time.
  KillDuplicateScriptsOnHost( ns, ns.getRunningScript() )

  if ( ns.args.length )
  {
    if( ns.args[0] == "quit" )
      return
  }

  if ( !ns.bladeburner.inBladeburner() )
  {
    ns.tprint( "You are not in a bladeburner, join a bladeburner before running this script." )
    ns.tprint( "Ending script." )
    return
  }

  let intelGatherStartingCity          = ns.bladeburner.getCity()

  let bladeburnerState = eBladeburnerStates.GATHER_INTEL

  let lastIntelGatherTime = -1
  let intelCycleCount = 0

  let targetChaosLevel = 0

  if ( ns.fileExists( BLADEBURNER_LAST_INTEL_TIME_FILENAME ) )
  {
    const jsonStringRead = ns.read( BLADEBURNER_LAST_INTEL_TIME_FILENAME )
    lastIntelGatherTime = JSON.parse( jsonStringRead )
  }

  let lastPopByCity = {
    "Aevum": 0,
    "Chongqing": 0,
    "Sector-12": 0,
    "New Tokyo": 0,
    "Ishima": 0,
    "Volhaven": 0,
  }

  if ( ns.fileExists( BLADEBURNER_LAST_CITY_POP_FILENAME ) )
  {
    const jsonStringRead = ns.read( BLADEBURNER_LAST_CITY_POP_FILENAME )
    lastPopByCity = JSON.parse( jsonStringRead )
  }

  let popTrendByCity = {
    "Aevum": "[ACCURATE]",
    "Chongqing": "[ACCURATE]",
    "Sector-12": "[ACCURATE]",
    "New Tokyo": "[ACCURATE]",
    "Ishima": "[ACCURATE]",
    "Volhaven": "[ACCURATE]",
  }

  if ( ns.fileExists( BLADEBURNER_CITY_POP_TREND_FILENAME ) )
  {
    const jsonStringRead = ns.read( BLADEBURNER_CITY_POP_TREND_FILENAME )
    popTrendByCity = JSON.parse( jsonStringRead )
  }

  let actionSuccessRatesByCity = {}
  if ( ns.fileExists( BLADEBURNER_ACTION_SUCCESS_RATES_BY_CITY_FILENAME ) )
  {
    const jsonStringRead = ns.read( BLADEBURNER_ACTION_SUCCESS_RATES_BY_CITY_FILENAME )
    actionSuccessRatesByCity = JSON.parse( jsonStringRead )
  }
  else
  {
    actionSuccessRatesByCity = InitializeSuccessRatesByCityData( ns )
  } 

  while ( true )
  {

    const systemDate = new Date()

    //const cityName = ns.bladeburner.getCity()
    //ns.bladeburner.switchCity

    /*
    1. We need to make sure our health and stamina isn't too low and heal if it gets too bad.

    2. We can likely construct a cycle of health and stamina recovery where we do contracts and operations until stamina or health gets low, heal, then do 
    recruitment and intel management until stamina gets back to normal.
    */

    const citiesNeedingChaosReduction = await CheckForCitiesNeedingChaosReduction( ns, actionSuccessRatesByCity )

    let currentCity = ns.bladeburner.getCity()
    let nextCityToScout = currentCity

    let stamina = ns.bladeburner.getStamina()
    let player  = ns.getPlayer()
    let bbRank  = ns.bladeburner.getRank()

    let bestCityChaos = -1
    let bestCityPop = -1
    let bestCity = currentCity

    let highestChaos = -1
    let mostChaoticCity = currentCity

    let lowestChaos = -1
    let leastChaoticCity = currentCity

    let largestPopulation = -1
    let mostPopulatedCity = currentCity

    let bonusTimeMult = 1.0

    const bonusTime = ns.bladeburner.getBonusTime()
    if ( bonusTime > 1000 )
      bonusTimeMult = 5.0
    
    await ns.write( BLADEBURNER_REPORT_FILENAME, "=================================================\n", "w" )
    await ns.write( BLADEBURNER_REPORT_FILENAME, "BLADEBURNER REPORT: \n" , "a" )
    await ns.write( BLADEBURNER_REPORT_FILENAME, "=================================================\n" , "a" )

    await ns.write( BLADEBURNER_REPORT_FILENAME, "Player Health: " + player.hp.current + " / " + player.hp.max + "\n", "a" )
    await ns.write( BLADEBURNER_REPORT_FILENAME, "Player Stamina: " + stamina[0] + " / " + stamina[1] + "\n", "a" )
    await ns.write( BLADEBURNER_REPORT_FILENAME, "\n", "a" )

    const timeSinceLastIntel = systemDate.getTime() - lastIntelGatherTime
    
    await ns.write( BLADEBURNER_REPORT_FILENAME, "Time Since Last Intel: " + GetReadableDateDelta( timeSinceLastIntel ) + "\n", "a" )
    await ns.write( BLADEBURNER_REPORT_FILENAME, "\n", "a" )
    
    
    for ( let i = 0; i < cityNames.length; i++ )
    {
      const cityName = cityNames[i]
      const cityChaos = ns.bladeburner.getCityChaos(cityName)
      const cityCommunities = ns.bladeburner.getCityCommunities(cityName)
      const cityEstPop = ns.bladeburner.getCityEstimatedPopulation(cityName)

      const lastCityEstPop = lastPopByCity[ cityName ]

      if ( cityChaos > highestChaos )
      {
        mostChaoticCity = cityName
        highestChaos = cityChaos
      }

      if ( cityChaos < lowestChaos || lowestChaos < 0 )
      {
        leastChaoticCity = cityName
        lowestChaos = cityChaos
      }

      if ( cityEstPop > largestPopulation )
      {
        mostPopulatedCity = cityName
        largestPopulation = cityEstPop
      }

      if ( cityEstPop > bestCityPop )
      {
        bestCity = cityName 
        bestCityPop = cityEstPop
        bestCityChaos = cityChaos
      }
        
      if ( cityName == currentCity )
      {
        if ( i == cityNames.length - 1 )
          nextCityToScout = cityNames[0]
        else
          nextCityToScout = cityNames[i + 1]
      }

      await ns.write( BLADEBURNER_REPORT_FILENAME, cityName + "\n", "a" )

      if ( citiesNeedingChaosReduction.includes( cityName ) )
        await ns.write( BLADEBURNER_REPORT_FILENAME, "Chaos Level: " + cityChaos + " [NEEDS REDUCTION]\n", "a" )
      else
        await ns.write( BLADEBURNER_REPORT_FILENAME, "Chaos Level: " + cityChaos + "\n", "a" )

      
      await ns.write( BLADEBURNER_REPORT_FILENAME, "Syth. Communities: " + cityCommunities + "\n", "a" )
      await ns.write( BLADEBURNER_REPORT_FILENAME, "Est. Population: " + AddCommasToNumber( cityEstPop ) + " " + popTrendByCity[ cityName ] + "\n", "a" )
      await ns.write( BLADEBURNER_REPORT_FILENAME, "\n", "a" )
    }

    await ns.write( BLADEBURNER_REPORT_FILENAME, "=================================================" + "\n", "a" )

    //Configure our skill purchase priority based on whether or not synth populations are controlled.
    if ( largestPopulation >= BLADEBURNER_AGGRESSIVE_CONTROL_POP_LEVEL )
      PurchaseSkills( ns, eBladeburnerSkillCategoryPriorityForControl )
    else
      PurchaseSkills( ns, eBladeburnerSkillCategoryPriorityForFarming )

    const nextBlackOP = ns.bladeburner.getNextBlackOp()
    let blackOPChance = [0.0, 0.0]
    
    if ( nextBlackOP != null )
      blackOPChance = ns.bladeburner.getActionEstimatedSuccessChance( eBladeburnerActionTypes.BLACKOPS, nextBlackOP.name )    

    //HEAL TO FULL HEALTH IF WE ARE BELOW HALF HEALTH
    if ( player.hp.current <= player.hp.max / 2 || bladeburnerState == eBladeburnerStates.HEAL )
    {
      bladeburnerState = eBladeburnerStates.HEAL
    }
    //GATHER INTEL AT REGULAR INTERVALS
    else if ( timeSinceLastIntel >= BLADEBURNER_INTEL_INTERVAL || lastIntelGatherTime < 0 )
    {
      if ( bladeburnerState != eBladeburnerStates.GATHER_INTEL )
      {
        intelCycleCount = 0
        intelGatherStartingCity = currentCity
      }
        
      bladeburnerState = eBladeburnerStates.GATHER_INTEL
    }
    //DO RECURITMENT AND TRAINING WHILE WE RECOVER STAMINA.
    else if ( stamina[0] < stamina[1] / 2 || bladeburnerState == eBladeburnerStates.DOWNTIME )
    {
      bladeburnerState = eBladeburnerStates.DOWNTIME
    }
    //CONTROL CHAOS (WE HEAL FIRST BECAUSE CHAOS NATURALLY DECREASES)
    else if ( citiesNeedingChaosReduction.includes( bestCity ) || bladeburnerState == eBladeburnerStates.CHAOS_CONTROL )
    {
      if ( bladeburnerState != eBladeburnerStates.CHAOS_CONTROL )
      {
        const travelSucessful = ns.bladeburner.switchCity( bestCity )

        targetChaosLevel = bestCityChaos / 2

        if ( travelSucessful )
          currentCity = bestCity
      }

      //Travel to high chaos city to control chaos.
      bladeburnerState = eBladeburnerStates.CHAOS_CONTROL
    }
    //PERFORM BLACKOPS
    else if ( blackOPChance[0] == BLADEBURNER_BLACKOPS_MIN_ACCEPTABLE_SUCCESS_CHANCE &&  bbRank >= nextBlackOP.rank &&
    blackOPChance[1] == BLADEBURNER_BLACKOPS_MIN_ACCEPTABLE_SUCCESS_CHANCE )
    {
      //To Do: Check all cities to see if any have a 100% success rate for this blackop.
      bladeburnerState = eBladeburnerStates.BLACKOPS
    }
    //KILL SYNTHETICS
    else if ( bestCityPop >= BLADEBURNER_ACCEPTABLE_POP_LEVEL )
    {
      bladeburnerState = eBladeburnerStates.POP_CONTROL
      const travelSucessful = ns.bladeburner.switchCity( bestCity )

      if ( travelSucessful )
        currentCity = bestCity
    }
    else
    {
      //If things are under control manage org.
      bladeburnerState = eBladeburnerStates.DOWNTIME 
    }
    
    if ( bladeburnerState == eBladeburnerStates.CHAOS_CONTROL)
    {
      if ( ns.bladeburner.getCityChaos( currentCity ) <= targetChaosLevel )
      {
        bladeburnerState = eBladeburnerStates.DOWNTIME
      }   
      else
      {

        ns.bladeburner.setTeamSize( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.STEALTH_KILL, ns.bladeburner.getTeamSize() )
        const stealthKillChance = ns.bladeburner.getActionEstimatedSuccessChance( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.STEALTH_KILL )

        //If we can lauch an stealth retirement opperation, do so. This will lower chaos and population.
        if ( stealthKillChance[0] >= BLADEBURNER_OPERATION_MIN_ACCEPTABLE_SUCCESS_CHANCE && stealthKillChance[1] == 1.0 &&
        ns.bladeburner.getActionCountRemaining( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.STEALTH_KILL ) >= 1 && 
        ns.bladeburner.getCityEstimatedPopulation( currentCity ) >= BLADEBURNER_ACCEPTABLE_POP_LEVEL )
        {
          ns.bladeburner.startAction( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.STEALTH_KILL )
          await ns.sleep( ns.bladeburner.getActionTime( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.STEALTH_KILL ) / bonusTimeMult )
        }
        else
        {
          //If city is too chaotic, try to reduce chaos level with diplomacy.
          ns.bladeburner.startAction( eBladeburnerActionTypes.GENERAL, eBladeburnerGeneralActions.DIPLOMACY )
          await ns.sleep( ns.bladeburner.getActionTime( eBladeburnerActionTypes.GENERAL, eBladeburnerGeneralActions.DIPLOMACY ) / bonusTimeMult )
        }
      } 
    }
    else if ( bladeburnerState == eBladeburnerStates.BLACKOPS )
    {
      //We have already done the checks to make sure we'll succeed.
      ns.bladeburner.startAction( eBladeburnerActionTypes.BLACKOPS, nextBlackOP.name )
      await ns.sleep( ns.bladeburner.getActionTime( eBladeburnerActionTypes.BLACKOPS, nextBlackOP.name ) / bonusTimeMult )
    }
    else if ( bladeburnerState == eBladeburnerStates.POP_CONTROL )
    {

      const bountyHuntChance = ns.bladeburner.getActionEstimatedSuccessChance( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.CAPTURE  )

      const retireChance = ns.bladeburner.getActionEstimatedSuccessChance( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.KILL  )

      ns.bladeburner.setTeamSize( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.STING, ns.bladeburner.getTeamSize() )
      const stingChance = ns.bladeburner.getActionEstimatedSuccessChance( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.STING )

      ns.bladeburner.setTeamSize( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.RAID, ns.bladeburner.getTeamSize() )
      const raidChance = ns.bladeburner.getActionEstimatedSuccessChance( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.RAID )

      if( ns.bladeburner.getCityEstimatedPopulation( currentCity ) >= BLADEBURNER_AGGRESSIVE_CONTROL_POP_LEVEL )
      {
        //If we can launch a raid, do so.
        if ( raidChance[0] >= BLADEBURNER_OPERATION_MIN_ACCEPTABLE_SUCCESS_CHANCE && raidChance[1] == 1.0 &&
        ns.bladeburner.getCityCommunities( currentCity ) > 0 &&
        ns.bladeburner.getActionCountRemaining( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.RAID ) >= 1  )
        {
          ns.bladeburner.startAction( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.RAID )
          await ns.sleep( ns.bladeburner.getActionTime( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.RAID ) / bonusTimeMult )
        }
        //If we can launch a sting opperation, do so.
        else if ( stingChance[0] >= BLADEBURNER_OPERATION_MIN_ACCEPTABLE_SUCCESS_CHANCE && stingChance[1] == 1.0 &&
        ns.bladeburner.getActionCountRemaining( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.STING ) >= 1  )
        {
          ns.bladeburner.startAction( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.STING )
          await ns.sleep( ns.bladeburner.getActionTime( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.STING ) / bonusTimeMult )
        }
        else if ( retireChance[1] > bountyHuntChance[1] && retireChance[0] >= BLADEBURNER_CONTRACT_MIN_ACCEPTABLE_SUCCESS_CHANCE &&
        ns.bladeburner.getActionCountRemaining( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.KILL ) >= 1 )
        {
          ns.bladeburner.startAction( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.KILL )
          await ns.sleep( ns.bladeburner.getActionTime( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.KILL ) / bonusTimeMult )
        }
        else if ( retireChance[1] == bountyHuntChance[1] && retireChance[0] > bountyHuntChance[0] && retireChance[0] >= BLADEBURNER_CONTRACT_MIN_ACCEPTABLE_SUCCESS_CHANCE &&
        ns.bladeburner.getActionCountRemaining( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.KILL ) >= 1 )
        {
          ns.bladeburner.startAction( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.KILL )
          await ns.sleep( ns.bladeburner.getActionTime( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.KILL ) / bonusTimeMult )
        }
        else if ( bountyHuntChance[0] >= BLADEBURNER_CONTRACT_MIN_ACCEPTABLE_SUCCESS_CHANCE && 
        ns.bladeburner.getActionCountRemaining( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.CAPTURE  ) >= 1 )
        {
          ns.bladeburner.startAction( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.CAPTURE )
          await ns.sleep( ns.bladeburner.getActionTime( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.CAPTURE ) / bonusTimeMult )
        }
        else if ( 
          ns.bladeburner.getActionCountRemaining( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.KILL ) < 1 &&
          ns.bladeburner.getActionCountRemaining( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.CAPTURE  ) < 1 )
        {
          //If we are totally out of contracts, we need to Incite Violence. This will increase chaos across all cities.
          ns.bladeburner.startAction(  eBladeburnerActionTypes.GENERAL, eBladeburnerGeneralActions.VIOLENCE )
          await ns.sleep( ns.bladeburner.getActionTime(  eBladeburnerActionTypes.GENERAL, eBladeburnerGeneralActions.VIOLENCE ) / bonusTimeMult )
        }
        else
        {
          bladeburnerState = eBladeburnerStates.DOWNTIME 
        }
      }
      else
      {
        
        if ( retireChance[1] == bountyHuntChance[1] && retireChance[0] > bountyHuntChance[0] && bountyHuntChance[0] >= BLADEBURNER_CONTRACT_MIN_ACCEPTABLE_SUCCESS_CHANCE &&
        ns.bladeburner.getActionCountRemaining( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.CAPTURE ) >= 1 )
        {
          ns.bladeburner.startAction( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.KILL )
          await ns.sleep( ns.bladeburner.getActionTime( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.KILL ) / bonusTimeMult )
        }
        else if ( bountyHuntChance[0] >= BLADEBURNER_CONTRACT_MIN_ACCEPTABLE_SUCCESS_CHANCE && 
        ns.bladeburner.getActionCountRemaining( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.CAPTURE  ) >= 1 )
        {
          ns.bladeburner.startAction( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.CAPTURE )
          await ns.sleep( ns.bladeburner.getActionTime( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.CAPTURE ) / bonusTimeMult )
        }
        else if ( retireChance[0] >= BLADEBURNER_CONTRACT_MIN_ACCEPTABLE_SUCCESS_CHANCE &&
        ns.bladeburner.getActionCountRemaining( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.KILL ) >= 1 )
        {
          ns.bladeburner.startAction( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.KILL )
          await ns.sleep( ns.bladeburner.getActionTime( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.KILL ) / bonusTimeMult )
        }
        else if ( 
          ns.bladeburner.getActionCountRemaining( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.KILL ) < 1 &&
          ns.bladeburner.getActionCountRemaining( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.CAPTURE  ) < 1 )
        {
          //If we are totally out of contracts, we need to Incite Violence. This will increase chaos across all cities.
          ns.bladeburner.startAction(  eBladeburnerActionTypes.GENERAL, eBladeburnerGeneralActions.VIOLENCE )
          await ns.sleep( ns.bladeburner.getActionTime(  eBladeburnerActionTypes.GENERAL, eBladeburnerGeneralActions.VIOLENCE ) / bonusTimeMult )
        }
        else
        {
          bladeburnerState = eBladeburnerStates.DOWNTIME 
        }
      }
      
      if ( ns.bladeburner.getCityEstimatedPopulation( currentCity ) <= BLADEBURNER_ACCEPTABLE_POP_LEVEL )
        bladeburnerState = eBladeburnerStates.DOWNTIME 

    }
    else if ( bladeburnerState == eBladeburnerStates.HEAL )
    {
      if ( player.hp.current == player.hp.max  )
      {
        bladeburnerState = eBladeburnerStates.DOWNTIME
      }
      else
      {
        if ( ns.singularity && ns.getServerMoneyAvailable( "home" ) >= BLADEBURNER_PAY_FOR_HOSPITAL_THRESHHOLD )
        {
          ns.singularity.hospitalize()
        }
        else
        {
          ns.bladeburner.startAction( eBladeburnerActionTypes.GENERAL, eBladeburnerGeneralActions.HEAL )
          await ns.sleep( ns.bladeburner.getActionTime( eBladeburnerActionTypes.GENERAL, eBladeburnerGeneralActions.HEAL ) / bonusTimeMult )
        }        
      }
    }
    else if ( bladeburnerState == eBladeburnerStates.DOWNTIME )
    {
      const skills = Object.keys( player.skills )

      let underSkilled = false
      for ( let skillIndex = 0; skillIndex < skills.length; skillIndex++ )
      {
        if ( player.skills[ skills[skillIndex] ] < 100 )
        {
          if ( skills[skillIndex] == "hacking" )
            continue
          
          if ( skills[skillIndex] == "charisma" )
            continue

          if ( skills[skillIndex] == "intelligence" )
            continue

          underSkilled = true
          break
        }
      }

      if ( underSkilled )
      {
        ns.bladeburner.startAction( eBladeburnerActionTypes.GENERAL, eBladeburnerGeneralActions.TRAIN )
        await ns.sleep( ns.bladeburner.getActionTime( eBladeburnerActionTypes.GENERAL, eBladeburnerGeneralActions.TRAIN ) / bonusTimeMult )
      }
      else if ( ns.bladeburner.getActionEstimatedSuccessChance( eBladeburnerActionTypes.GENERAL, eBladeburnerGeneralActions.RECRUIT )[0] > BLADEBURNER_RECRUIT_SUCCESS_THRESHOLD )
      {
        ns.bladeburner.startAction( eBladeburnerActionTypes.GENERAL, eBladeburnerGeneralActions.RECRUIT )
        await ns.sleep( ns.bladeburner.getActionTime( eBladeburnerActionTypes.GENERAL, eBladeburnerGeneralActions.RECRUIT ) / bonusTimeMult )
      }
      else
      {
        ns.bladeburner.startAction( eBladeburnerActionTypes.GENERAL, eBladeburnerGeneralActions.TRAIN )
        await ns.sleep( ns.bladeburner.getActionTime( eBladeburnerActionTypes.GENERAL, eBladeburnerGeneralActions.TRAIN ) / bonusTimeMult )
      }

      //We have an issue where training uses stamina, so we can't use full stamina recovery as a metric for when to exit training.
      if ( stamina[0] >= stamina[1] - 1 )
      {
        bladeburnerState = eBladeburnerStates.GATHER_INTEL
      }
    }
    else if ( bladeburnerState == eBladeburnerStates.GATHER_INTEL )
    {   
        if ( BLADEBURNER_INTEL_CYCLES_PER_CITY <= intelCycleCount )
        {
          //We cycle through the cities to scout evenly for intel.
          const travelSucessful = ns.bladeburner.switchCity( nextCityToScout )

          if ( travelSucessful )
          {
            currentCity = nextCityToScout
            intelCycleCount = 0
          }

          if ( currentCity == intelGatherStartingCity )
          {
            lastIntelGatherTime = systemDate.getTime()

            const jsonStringWrite = JSON.stringify( lastIntelGatherTime )
            await ns.write( BLADEBURNER_LAST_INTEL_TIME_FILENAME, jsonStringWrite, "w" )
          }
        }
        else
        {
          //Some intel actions impact world wide intel, but most don't.
          let worldWideIntel = false


          const trackChance = ns.bladeburner.getActionEstimatedSuccessChance( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.TRACK )

          ns.bladeburner.setTeamSize( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.INVESTIGATE, ns.bladeburner.getTeamSize() )
          const investigationChance = ns.bladeburner.getActionEstimatedSuccessChance( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.INVESTIGATE )

          ns.bladeburner.setTeamSize( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.UNDERCOVER, ns.bladeburner.getTeamSize() )
          const undercoverChance = ns.bladeburner.getActionEstimatedSuccessChance( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.UNDERCOVER )

          //If we can lauch an undercover opperation, do so.
          if ( undercoverChance[0] >= BLADEBURNER_INTEL_MIN_ACCEPTABLE_SUCCESS_CHANCE && investigationChance[1] == 1.0 &&
          ns.bladeburner.getActionCountRemaining( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.UNDERCOVER ) >= 1  )
          {
            ns.bladeburner.startAction( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.UNDERCOVER )
            await ns.sleep( ns.bladeburner.getActionTime( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.UNDERCOVER ) / bonusTimeMult )
            worldWideIntel = true
          }
          //If we can lauch an investigation opperation, do so.
          else if ( investigationChance[0] >= BLADEBURNER_INTEL_MIN_ACCEPTABLE_SUCCESS_CHANCE && investigationChance[1] == 1.0 &&
          ns.bladeburner.getActionCountRemaining( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.INVESTIGATE ) >= 1  )
          {
            ns.bladeburner.startAction( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.INVESTIGATE )
            await ns.sleep( ns.bladeburner.getActionTime( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.INVESTIGATE ) / bonusTimeMult )
            worldWideIntel = true
          }
          //Otherwise, gather field inteligence.
          else
          {
            ns.bladeburner.startAction(  eBladeburnerActionTypes.GENERAL, eBladeburnerGeneralActions.INTEL )
            await ns.sleep( ns.bladeburner.getActionTime(  eBladeburnerActionTypes.GENERAL, eBladeburnerGeneralActions.INTEL ) / bonusTimeMult )
          }


          //Otherwise do a track contract.
          //To Do: Track contracts don't seem to improve our data, but they give good early game experience, we need to figure out where to run this.
          /*
          if ( trackChance[0] >= 0.5 && 
          ns.bladeburner.getActionCountRemaining( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.TRACK ) >= 1 )
          {
            ns.bladeburner.startAction( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.TRACK )
            await ns.sleep( ns.bladeburner.getActionTime( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.TRACK ) / bonusTimeMult )
          }
          */
          
          

          for ( let cityIndex = 0; cityIndex < cityNames.length; cityIndex++ )
          {
            const cityName = cityNames[cityIndex]
            const postIntelPopEst = ns.bladeburner.getCityEstimatedPopulation( cityName )

            if ( cityName == currentCity )
            {
              if ( postIntelPopEst == lastPopByCity[ cityName ] )
                intelCycleCount = BLADEBURNER_INTEL_CYCLES_PER_CITY
              else
                intelCycleCount++
            }

            if ( worldWideIntel || cityName == currentCity )
            {
              if ( postIntelPopEst < lastPopByCity[ cityName ] )
                popTrendByCity[ cityName ] = "[ESTIMATION HIGH]"
              else if ( postIntelPopEst > lastPopByCity[ cityName ] )
                popTrendByCity[ cityName ] = "[ESTIMATION LOW]"
              else
                popTrendByCity[ cityName ] = "[ESTIMATION ACCURATE]"

              lastPopByCity[ cityName ] = postIntelPopEst
            }
          }

          const jsonStringWritePopTrend = JSON.stringify( popTrendByCity )
          await ns.write( BLADEBURNER_CITY_POP_TREND_FILENAME, jsonStringWritePopTrend, "w" )

          const jsonStringWrite = JSON.stringify( lastPopByCity )
          await ns.write( BLADEBURNER_LAST_CITY_POP_FILENAME, jsonStringWrite, "w" )
        }
    }

    await ns.sleep( 1000 )
  }

}

function InitializeSuccessRatesByCityData( ns )
{
  let actionSuccessRatesByCity = {}

  const currentCity = ns.bladeburner.getCity()

  for ( let i = 0; i < cityNames.length; i++ )
  {
    const cityName = cityNames[i]

    ns.bladeburner.switchCity( cityName )

    //Store Contract Success
    let contractSuccessRates = {}
    contractSuccessRates[ eBladeburnerContractActions.TRACK ] = ns.bladeburner.getActionEstimatedSuccessChance( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.TRACK )
    contractSuccessRates[ eBladeburnerContractActions.CAPTURE ] = ns.bladeburner.getActionEstimatedSuccessChance( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.CAPTURE )
    contractSuccessRates[ eBladeburnerContractActions.KILL ] = ns.bladeburner.getActionEstimatedSuccessChance( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.KILL )
 
    let operationSuccessRates = {}
    operationSuccessRates[eBladeburnerOperationActions.INVESTIGATE] = ns.bladeburner.getActionEstimatedSuccessChance( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.INVESTIGATE)
    operationSuccessRates[eBladeburnerOperationActions.UNDERCOVER] = ns.bladeburner.getActionEstimatedSuccessChance( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.UNDERCOVER)
    operationSuccessRates[eBladeburnerOperationActions.STING] = ns.bladeburner.getActionEstimatedSuccessChance( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.STING)
    operationSuccessRates[eBladeburnerOperationActions.RAID] = ns.bladeburner.getActionEstimatedSuccessChance( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.RAID)
    operationSuccessRates[eBladeburnerOperationActions.STEALTH_KILL] = ns.bladeburner.getActionEstimatedSuccessChance( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.STEALTH_KILL)
    operationSuccessRates[eBladeburnerOperationActions.ASSASSINATION] = ns.bladeburner.getActionEstimatedSuccessChance( eBladeburnerActionTypes.OPERATIONS, eBladeburnerOperationActions.ASSASSINATION)
    
    let successRatesByActionType = {}
    successRatesByActionType[ eBladeburnerActionTypes.CONTRACTS ] = contractSuccessRates
    successRatesByActionType[ eBladeburnerActionTypes.OPERATIONS ] = operationSuccessRates

    actionSuccessRatesByCity[ cityName ] = successRatesByActionType
  }

  ns.bladeburner.switchCity( currentCity )

  return actionSuccessRatesByCity
}

async function CheckForCitiesNeedingChaosReduction( ns, actionSuccessRatesByCity )
{
  let citiesNeedingChaosReduction = []

  const actionTypesToCheck = [ eBladeburnerActionTypes.CONTRACTS, eBladeburnerActionTypes.OPERATIONS ]

  const currentCity = ns.bladeburner.getCity()

  for ( let i = 0; i < cityNames.length; i++ )
  {
    const cityName = cityNames[i]
    ns.bladeburner.switchCity( cityName )

    let cityNeedsChaosReduction = false
    for ( let actionTypeIndex = 0; actionTypeIndex < actionTypesToCheck.length; actionTypeIndex++ )
    {
      const actionType = actionTypesToCheck[actionTypeIndex]
      const actions = Object.keys( actionSuccessRatesByCity[ cityName ][ actionType ] )

      for ( let actionIndex = 0; actionIndex < actions.length; actionIndex++ )
      {
        const action = actions[actionIndex]
        const actionSuccessRate = ns.bladeburner.getActionEstimatedSuccessChance( actionType, action )

        if ( actionSuccessRate[0] > actionSuccessRatesByCity[cityName][actionType][action][0] || 
        actionSuccessRate[1] > actionSuccessRatesByCity[cityName][actionType][action][1] )
        {
          actionSuccessRatesByCity[cityName][actionType][action] = actionSuccessRate
        }
        else if( actionSuccessRate[0] < actionSuccessRatesByCity[cityName][actionType][action][0] || 
        actionSuccessRate[1] < actionSuccessRatesByCity[cityName][actionType][action][1] )
        {
          //If there are no synth communities in this city, raid success with be 0 regardless of other factors.
          if ( action == eBladeburnerOperationActions.RAID && ns.bladeburner.getCityCommunities( cityName ) == 0 )
            continue 

          cityNeedsChaosReduction = true
        }
      }
    }

    if ( cityNeedsChaosReduction )
      citiesNeedingChaosReduction.push( cityName )

  }

  const jsonStringWrite = JSON.stringify( actionSuccessRatesByCity )
  await ns.write( BLADEBURNER_ACTION_SUCCESS_RATES_BY_CITY_FILENAME, jsonStringWrite, "w" )

  ns.bladeburner.switchCity( currentCity )

  return citiesNeedingChaosReduction

}

function PurchaseSkills( ns, priorityConfiguration )
{
  let skillPointCount = ns.bladeburner.getSkillPoints()
  const skillCategories = Object.keys( priorityConfiguration )

  for ( let skillCategoryIndex = 0; skillCategoryIndex < skillCategories.length; skillCategoryIndex++ )
  {
    const skillCategory = skillCategories[skillCategoryIndex]
    const skillNames = priorityConfiguration[skillCategory]
    for ( let skillIndex = 0; skillIndex < skillNames.length; skillIndex++ )
    {
      const skillName = skillNames[skillIndex]      
      const skillCost = ns.bladeburner.getSkillUpgradeCost( skillName, 1 )

      if ( skillCost <= skillPointCount )
      {
        ns.bladeburner.upgradeSkill( skillName, 1 )
        skillPointCount -= skillCost
      }
    }
  }
}