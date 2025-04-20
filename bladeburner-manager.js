import { KillDuplicateScriptsOnHost } from "utility.js"
import { AddCommasToNumber } from "utility.js"

const BLADEBURNER_LAST_INTEL_TIME_FILENAME = "bladeburner_intel_time.txt"
const BLADEBURNER_LAST_CITY_POP_FILENAME = "bladeburner_last_city_pop.txt"

const BLADEBURNER_MAX_ALLOWED_CHAOS = 1.0
const BLADEBURNER_ACCEPTABLE_CHAOS_LEVEL = 0.5
const BLADEBURNER_ACCEPTABLE_POP_LEVEL = 1000000000

const BLADEBURNER_PAY_FOR_HOSPITAL_THRESHHOLD = 50000000

const BLADEBURNER_RECRUIT_SUCCESS_THRESHOLD = 0.3666666

//Every 15 minutes update intel.
const BLADEBURNER_INTEL_INTERVAL = (1000 * 60) * 15
const BLADEBURNER_INTEL_CYCLES_PER_CITY = 5

/** @param {NS} ns */
export async function main(ns) 
{

  const cityNames = [ "Aevum", "Chongqing", "Sector-12", "New Tokyo", "Ishima", "Volhaven" ]

  const eBladeburnerStates = Object.freeze({
    DOWNTIME: 0,
    CHAOS_CONTROL: 1,
    POP_CONTROL:2,
    GATHER_INTEL: 3,
    HEAL: 4,
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

  const generalActionNames  = ns.bladeburner.getGeneralActionNames()
  const contractNames       = ns.bladeburner.getContractNames()
  const operationNames      = ns.bladeburner.getOperationNames()

  let bladeburnerState = eBladeburnerStates.GATHER_INTEL

  let lastIntelGatherTime = -1
  let intelCycleCount = 0
  const systemDate = new Date()

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

  while ( true )
  {

    //const cityName = ns.bladeburner.getCity()
    //ns.bladeburner.switchCity

    /*
    1. We need to make sure our health and stamina isn't too low and heal if it gets too bad.

    2. We can likely construct a cycle of health and stamina recovery where we do contracts and operations until stamina or health gets low, heal, then do 
    recruitment and intel management until stamina gets back to normal.
    */

    let currentCity = ns.bladeburner.getCity()
    let nextCityToScout = currentCity

    let stamina = ns.bladeburner.getStamina()
    let player  = ns.getPlayer()

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

    ns.tprint( "=================================================" )
    ns.tprint( "BLADEBURNER REPORT:" )
    ns.tprint( "=================================================" )

    ns.tprint( "Player Health: " + player.hp.current + " / " + player.hp.max )
    ns.tprint( "Player Stamina: " + stamina[0] + " / " + stamina[1] )
    ns.tprint( "\n" )

    for ( let i = 0; i < cityNames.length; i++ )
    {
      const cityName = cityNames[i]
      const cityChaos = ns.bladeburner.getCityChaos(cityName)
      const cityCommunities = ns.bladeburner.getCityCommunities(cityName)
      const cityEstPop = ns.bladeburner.getCityEstimatedPopulation(cityName)

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

      ns.tprint( cityName )
      ns.tprint( "Chaos Level: " + cityChaos )
      ns.tprint( "Syth. Communities: " + cityCommunities )
      ns.tprint( "Est. Population: " + AddCommasToNumber( cityEstPop ) )
      ns.tprint( "\n" )


    }

    ns.tprint( "=================================================" )

    //HEAL TO FULL HEALTH IF WE ARE BELOW HALF HEALTH
    if ( player.hp.current <= player.hp.max / 2 || bladeburnerState == eBladeburnerStates.HEAL )
    {
      bladeburnerState = eBladeburnerStates.HEAL
    }
    //DO RECURITMENT AND TRAINING WHILE WE RECOVER STAMINA.
    else if ( stamina[0] < stamina[1] / 2 || bladeburnerState == eBladeburnerStates.DOWNTIME )
    {
      bladeburnerState = eBladeburnerStates.DOWNTIME
    }
    //GATHER INTEL AT REGULAR INTERVALS
    else if ( systemDate.getTime() - lastIntelGatherTime >= BLADEBURNER_INTEL_INTERVAL || lastIntelGatherTime < 0 )
    {
      if ( bladeburnerState != eBladeburnerStates.GATHER_INTEL )
      {
        intelCycleCount = 0
        intelGatherStartingCity = currentCity
      }
        
      bladeburnerState = eBladeburnerStates.GATHER_INTEL
    }
    //CONTROL CHAOS (WE HEAL FIRST BECAUSE CHAOS NATURALLY DECREASES)
    else if ( bestCityChaos >= BLADEBURNER_MAX_ALLOWED_CHAOS || bladeburnerState == eBladeburnerStates.CHAOS_CONTROL )
    {
      if ( bladeburnerState != eBladeburnerStates.CHAOS_CONTROL )
      {
        const travelSucessful = ns.bladeburner.switchCity( bestCity )

        if ( travelSucessful )
          currentCity = bestCity
      }

      //Travel to high chaos city to control chaos.
      bladeburnerState = eBladeburnerStates.CHAOS_CONTROL
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
      if ( ns.bladeburner.getCityChaos( currentCity ) <= BLADEBURNER_ACCEPTABLE_CHAOS_LEVEL )
      {
        bladeburnerState = eBladeburnerStates.DOWNTIME
      }   
      else
      {
        //If city is too chaotic, try to reduce chaos level.
        ns.bladeburner.startAction( eBladeburnerActionTypes.GENERAL, eBladeburnerGeneralActions.DIPLOMACY )
        await ns.sleep( ns.bladeburner.getActionTime( eBladeburnerActionTypes.GENERAL, eBladeburnerGeneralActions.DIPLOMACY ) / bonusTimeMult )
      } 
    }
    else if ( bladeburnerState == eBladeburnerStates.POP_CONTROL )
    {

      const bountyHuntChance = ns.bladeburner.getActionEstimatedSuccessChance( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.CAPTURE  )
      const retireChance = ns.bladeburner.getActionEstimatedSuccessChance( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.KILL  )

      if ( retireChance[1] > bountyHuntChance[1] &&
      ns.bladeburner.getActionCountRemaining( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.KILL ) > 0 )
      {
        ns.bladeburner.startAction( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.KILL )
        await ns.sleep( ns.bladeburner.getActionTime( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.KILL ) / bonusTimeMult )
      }
      else if ( retireChance[1] == bountyHuntChance[1] && retireChance[0] > bountyHuntChance[0] &&
      ns.bladeburner.getActionCountRemaining( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.KILL ) > 0 )
      {
        ns.bladeburner.startAction( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.KILL )
        await ns.sleep( ns.bladeburner.getActionTime( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.KILL ) / bonusTimeMult )
      }
      else if ( ns.bladeburner.getActionCountRemaining( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.CAPTURE  ) > 0 )
      {
        ns.bladeburner.startAction( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.CAPTURE )
        await ns.sleep( ns.bladeburner.getActionTime( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.CAPTURE ) / bonusTimeMult )
      }
      else
      {
        //If we are totally out of contracts, we need to Incite Violence. This will increase chaos across all cities.
        ns.bladeburner.startAction(  eBladeburnerActionTypes.GENERAL, eBladeburnerGeneralActions.VIOLENCE )
        await ns.sleep( ns.bladeburner.getActionTime(  eBladeburnerActionTypes.GENERAL, eBladeburnerGeneralActions.VIOLENCE ) / bonusTimeMult )
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
      if ( stamina[0] == stamina[1] )
      {
        bladeburnerState = eBladeburnerStates.GATHER_INTEL
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
          const trackChance = ns.bladeburner.getActionEstimatedSuccessChance( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.TRACK )

          if ( trackChance[0] >= 0.5 && 
          ns.bladeburner.getActionCountRemaining( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.TRACK ) > 0 )
          {
            ns.bladeburner.startAction( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.TRACK )
            await ns.sleep( ns.bladeburner.getActionTime( eBladeburnerActionTypes.CONTRACTS, eBladeburnerContractActions.TRACK ) / bonusTimeMult )
          }
          else
          {
            ns.bladeburner.startAction(  eBladeburnerActionTypes.GENERAL, eBladeburnerGeneralActions.INTEL )
            await ns.sleep( ns.bladeburner.getActionTime(  eBladeburnerActionTypes.GENERAL, eBladeburnerGeneralActions.INTEL ) / bonusTimeMult )
          }

          const postIntelPopEst = ns.bladeburner.getCityEstimatedPopulation( currentCity )
          if ( postIntelPopEst == lastPopByCity[ currentCity ] )
            intelCycleCount = BLADEBURNER_INTEL_CYCLES_PER_CITY
          else
            intelCycleCount++

          lastPopByCity[ currentCity ] = postIntelPopEst
          const jsonStringWrite = JSON.stringify( lastPopByCity )
          await ns.write( BLADEBURNER_LAST_CITY_POP_FILENAME, jsonStringWrite, "w" )

        }
    }

    await ns.sleep( 1000 )
  }

}