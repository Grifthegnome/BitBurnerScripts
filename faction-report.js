const FACTION_NAMES_FILENAME = "faction_names.txt"

/** @param {NS} ns */
export async function main(ns) 
{

  if ( !(ns.singularity) )
  {
    ns.tprint( "You don't have access to the singularity API." )
    ns.tprint( "Terminating script." )
    return
  }

  

  /*
  There might be a way for us to pull a sneaky trick here and reveal more factions through a cyclical augmentation/faction search.

  In Theory:

  for factions we have, we could call: ns.singularity.getAugmentationsFromFaction to build a list of known augmentations.

  We know that factions share augmentations, so if we then call ns.singularity.getAugmentationFactions, we could find factions we don't know about.

  We could then call ns.singularity.getAugmentationsFromFaction on these new factions to see if we can get any 2nd or 3rd order factions.

  We would continue until our faction list doesn't change after one cycle.
  */




  //There is no way to get a complete list of factions. We are gonna need to build a log of faction names over time as we join factions and recieve invites.
  let knownFactions = Array()
  if ( ns.fileExists( FACTION_NAMES_FILENAME ) )
  {
    const jsonString = ns.read( FACTION_NAMES_FILENAME )
    knownFactions = JSON.parse( jsonString )
  }

  const factionStartingCount = knownFactions.length

  const player = ns.getPlayer()
  const memberFactions = player.factions
  const inviteFactions = ns.singularity.checkFactionInvitations()

  const currentKnownFactions = memberFactions.concat( inviteFactions )
  for ( let factionIndex = 0; factionIndex < currentKnownFactions.length; factionIndex++ )
  {
    const factionName = currentKnownFactions[ factionIndex ]
    if ( !knownFactions.includes( factionName ) )
    {
      knownFactions.push( factionName )
    }
  }

  //See if we can scrape additional factions from augment lists.
  knownFactions = ScrapeFactionsFromAugments(ns, knownFactions)

  const factionCurrentCount = knownFactions.length

  //Write any new factions to our faction name file.
  if ( factionStartingCount != factionCurrentCount )
  {
    const jsonString = JSON.stringify( knownFactions )
    await ns.write( FACTION_NAMES_FILENAME, jsonString, "w" )
  }

  ns.tprint( "======================================================" )
  ns.tprint( "FACTION REPORT" )
  ns.tprint( "======================================================" )

  for ( let factionIndex = 0; factionIndex < knownFactions.length; factionIndex++ )
  {
    const factionName = knownFactions[ factionIndex ]

    ns.tprint( factionName )

    const playerRequirements = ns.singularity.getFactionInviteRequirements( factionName )

    if ( factionName == "NWO" )
      debugger

    PrintFactionPlayerRequirements( ns, playerRequirements )

    //ns.singularity.getAugmentationFactions

    //ns.singularity.getAugmentationsFromFaction

  }

}

function ScrapeFactionsFromAugments( ns, knownFactions )
{
  let scrapedFactions = knownFactions.slice()
  for ( let factionIndex = 0; factionIndex < knownFactions.length; factionIndex++ )
  {
    const factionName = knownFactions[ factionIndex ]
    const augmentationList = ns.singularity.getAugmentationsFromFaction( factionName )

    for ( let augmentIndex = 0; augmentIndex < augmentationList.length; augmentIndex++ )
    {
      const augmentationName = augmentationList[ augmentIndex ]
      const factionsWithAugmentation = ns.singularity.getAugmentationFactions( augmentationName )

      //Note: This might cause bugs, but it seems like it saves us cycles once we have all the factions.
      if ( factionsWithAugmentation.length == scrapedFactions.length )
        break

      for ( let fwaIndex = 0; fwaIndex < factionsWithAugmentation.length; fwaIndex++ )
      {
        const factionWithAugmentation = factionsWithAugmentation[ fwaIndex ]

        if ( !scrapedFactions.includes( factionWithAugmentation ) )
          scrapedFactions.push( factionWithAugmentation )
      }
    }
  }

  if ( scrapedFactions.length > knownFactions.length )
  {
    scrapedFactions = ScrapeFactionsFromAugments( ns, scrapedFactions )
  }

  return scrapedFactions

}

function PrintFactionPlayerRequirements( ns, requirements )
{

  for ( let requirementIndex = 0; requirementIndex < requirements.length; requirementIndex++ )
  {
    const requirement = requirements[ requirementIndex ]
    
    const keys = Object.keys( requirement )
    
    for ( let keyIndex = 0; keyIndex < keys.length; keyIndex++ )
    {
      const key = keys[ keyIndex ]

      if ( key == "type" )
      {
        continue
      }
      else if ( key == "reputation" )
      {
        //This is handled in the company section.
        continue
      }
      else if ( key == "server" )
      {
        debugger
        const conditionType = requirement[ "type" ]

        if ( conditionType == "backdoorInstalled" ) 
          ns.tprint( "    " + "Server Backdoor" + ": " + requirement[ key ] )
        else
          ns.tprint( "    " + key + ": " + requirement[ key ] )
      }
      else if ( key == "skills" )
      {
        //ns.tprint( "    " + key + ": " )
        const skillKeys = Object.keys( requirement[ key ] )
        for ( let skillIndex = 0; skillIndex < skillKeys.length; skillIndex++ )
        {
          const skillKey = skillKeys[ skillIndex ]
          ns.tprint( "    " + skillKey + ": " + requirement[ key ][ skillKey ] )
        }
      }
      else if ( key == "company" )
      {
        const conditionType = requirement[ "type" ]
        
        let conditionTypeString = ""
        if ( "employedBy" == conditionType )
          conditionTypeString = "Employed By: " + requirement[ key ]

        if ( "companyReputation" == conditionType )
          conditionTypeString = (requirement[ key ] + " Reputation: " + requirement[ "reputation" ])

        ns.tprint( "    " + conditionTypeString )

      }
      else if ( key == "conditions" )
      {
        PrintFactionPlayerRequirements( ns, requirement[ key ] )
      }
      else if ( key == "condition" )
      {
        const condition = requirement[ key ]
        const flag      = requirement[ "type" ]
        const criteria  = requirement[ key ][ "type" ]

        const conditionKeys = Object.keys( condition )
        for( let conditionKeyIndex = 0; conditionKeyIndex < conditionKeys.length; conditionKeyIndex++ )
        {
          const conditionKey = conditionKeys[ conditionKeyIndex ]

          if ( conditionKey == "type" )
            continue

          let flagString = ""
          let criteriaString = ""

          if ( flag == "not" )
            flagString = "Not"

          if ( criteria == "employedBy" )
            criteriaString = "Employed By"

          ns.tprint( "    " + flagString + " " + criteriaString + ": " + condition[ conditionKey ] )
        }
      }
      else
      {
        ns.tprint( "    " + key + ": " + requirement[ key ] )
      }
    } 
  }

  
}