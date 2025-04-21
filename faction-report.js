import {AddCommasToNumber} from "utility.js"

const FACTION_NAMES_FILENAME = "faction_names.txt"
const FACTION_RESTRICTED_AUGMENTS_FILENAME = "faction_restricted_augments.txt"
const FACTION_REPORT_FILENAME = "faction_report.txt"

const FACTION_MAX_INSERT_SPACES = 57

const FACTION_REQUIREMENTS_HEADER = "REQUIREMENTS<==========================================================>REQUIREMENTS"
const FACTION_UNAQUIRED_AUGMENT_HEADER = "REMAINING AUGMENTATIONS<==============================================>REMAINING AUGMENTATIONS"
const FACTION_UNAQUIRED_AUGMENT_HEADER_DOUBLE_WIDE = "REMAINING AUGMENTATIONS<=======================================================================================================================>REMAINING AUGMENTATIONS"
const FACTION_OWNED_AUGMENT_HEADER = "OWNED AUGMENTATIONS<==================================================>OWNED AUGMENTATIONS"
const FACTION_OWNED_AUGMENT_HEADER_DOUBLE_WIDE = "OWNED AUGMENTATIONS<===========================================================================================================================>OWNED AUGMENTATIONS"

const FACTION_REQUIREMENT_INDENT_STRING = "   |->"

const FACTION_TOP_LEVEL_INDENT_STRING = "*->"
const FACTION_FIRST_LINE_ENTRY_OWNED_AUGMENT_INDENT_STRING = "   |->"
const FACTION_SUBSEQUENT_LINE_ENTRY_OWNED_AUGMENT_INDENT_STRING = "  |->"
const FACTION_FIRST_LINE_ENTRY_UNOWNED_AUGMENT_INDENT_STRING = "   |->"
const FACTION_SUBSEQUENT_LINE_ENTRY_UNOWNED_AUGMENT_INDENT_STRING = "  |->"

function FactionScrapeData( scrapedFactions, factionRestrictedAugments )
{
  this.scrapedFactions = scrapedFactions
  this.factionRestrictedAugments = factionRestrictedAugments
}

function FactionProgressData( isMember, isInvited, isComplete, progressFrac, factionMaxRepNeeded )
{
  this.isMember = isMember
  this.isInvited = isInvited
  this.isComplete = isComplete
  this.progressFrac = progressFrac
  this.factionMaxRepNeeded = factionMaxRepNeeded
}

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

  let factionRestrictedAugments = Array()
  if ( ns.fileExists( FACTION_RESTRICTED_AUGMENTS_FILENAME ) )
  {
    const jsonString = ns.read( FACTION_RESTRICTED_AUGMENTS_FILENAME )
    factionRestrictedAugments = JSON.parse( jsonString )
  }

  const factionStartingCount = knownFactions.length
  const factionRestrictedAugmentsStartingCount = factionRestrictedAugments.length

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
  const factionScrapeData = ScrapeFactionsFromAugments(ns, knownFactions)
  knownFactions = factionScrapeData.scrapedFactions
  factionRestrictedAugments = factionScrapeData.factionRestrictedAugments

  //Write any new factions to our faction name file.
  if ( factionStartingCount != knownFactions.length )
  {
    const jsonString = JSON.stringify( knownFactions )
    await ns.write( FACTION_REPORT_FILENAME, FACTION_NAMES_FILENAME, jsonString, "w" )
  }

  if ( factionRestrictedAugmentsStartingCount != factionRestrictedAugments.length )
  {
    const jsonString = JSON.stringify( factionRestrictedAugments )
    await ns.write( FACTION_REPORT_FILENAME, FACTION_RESTRICTED_AUGMENTS_FILENAME, jsonString, "w" )
  }

  if ( ns.args.length )
  {
    if ( knownFactions.includes( ns.args[0] ) )
    {
      knownFactions = [ ns.args[0] ]
    }
    else
    {
      ns.tprint( ns.args[0] + " is not a valid faction." )
      ns.tprint( "Terminating script." )
      return
    }
  }
    

  const installedPlayerAugmentations = ns.singularity.getOwnedAugmentations()
  const allPlayerAugmentations = ns.singularity.getOwnedAugmentations( true )
  const purchasedPlayerAugmentations = allPlayerAugmentations.filter( item => !installedPlayerAugmentations.includes( item ) )

  let factionPriorityHash = {}
  let factionProgressHash = {}

  for ( let factionIndex = 0; factionIndex < knownFactions.length; factionIndex++ )
  {
    const factionName = knownFactions[ factionIndex ]

    const isMember  = memberFactions.includes( factionName )
    const isInvited = inviteFactions.includes( factionName )

    let isComplete = true
    let factionAugmentations = ns.singularity.getAugmentationsFromFaction( factionName )
    let factionAugmentsOwned = 0
    let factionMaxRepNeeded = 0
    for ( let augmentIndex = 0; augmentIndex < factionAugmentations.length; augmentIndex++ )
    {
      const augmentationName = factionAugmentations[ augmentIndex ]

      const requiredRep = ns.singularity.getAugmentationRepReq( augmentationName )

      

      if ( !allPlayerAugmentations.includes( augmentationName ) )
      {

        //We don't want to count the reputation requirement of the NeuroFlux Governor augment because it can be leveled infinitely.
        if ( requiredRep > factionMaxRepNeeded && augmentationName != "NeuroFlux Governor" )
          factionMaxRepNeeded = requiredRep

        isComplete = false
      }
      else
      {
        factionAugmentsOwned++
      }
    }

    const progressFrac = factionAugmentsOwned / factionAugmentations.length

    if ( !( factionName in factionProgressHash ) )
    {
      const progressData = new FactionProgressData( isMember, isInvited, isComplete, progressFrac, factionMaxRepNeeded )
      factionProgressHash[ factionName ] = progressData
    }

    if ( !( factionName in factionPriorityHash ) )
    {
      if ( isComplete )
      {
        factionPriorityHash[ factionName ] = 0.0
      }
      else if ( isMember )
      {
        factionPriorityHash[ factionName ] = 1.0
      }
      else if ( isInvited )
      {
        factionPriorityHash[ factionName ] = 0.5
      }
      else
      {
        factionPriorityHash[ factionName ] = 0.25
      }
    }
  }

  knownFactions.sort( (factionA, factionB) => factionPriorityHash[factionA] - factionPriorityHash[factionB] )

  ns.tprint( "\n" )
  ns.tprint( "/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////" )
  ns.tprint( "//                                                               FACTION REPORT                                                                //" )
  ns.tprint( "/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////" )

  await ns.write( FACTION_REPORT_FILENAME, "\n", "w" )
  await ns.write( FACTION_REPORT_FILENAME, "/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////\n" , "a" )
  await ns.write( FACTION_REPORT_FILENAME, "//                                                               FACTION REPORT                                                                //\n" , "a" )
  await ns.write( FACTION_REPORT_FILENAME, "/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////\n" , "a" )

  for ( let factionIndex = 0; factionIndex < knownFactions.length; factionIndex++ )
  {
    const factionName         = knownFactions[ factionIndex ]
    const availableFunds      = ns.getServerMoneyAvailable( "home" )
    const factionRep          = ns.singularity.getFactionRep( factionName )
    const clampedRep          = Math.floor( factionRep )

    const isMember            = factionProgressHash[factionName].isMember
    const isInvited           = factionProgressHash[factionName].isInvited
    const isComplete          = factionProgressHash[factionName].isComplete
    const progressFrac        = factionProgressHash[factionName].progressFrac
    const factionMaxRepNeeded = factionProgressHash[factionName].factionMaxRepNeeded
    const clampedMaxRep       = Math.floor( factionMaxRepNeeded )
    const isMemberOrInvited   = isMember || isInvited

    if ( isComplete )
    {
      ns.tprint( "=======================================================================================================" )
      ns.tprint( factionName + " [COMPLETE]" )
      ns.tprint( "=======================================================================================================" )

      await ns.write( FACTION_REPORT_FILENAME, "=======================================================================================================\n" , "a" )
      await ns.write( FACTION_REPORT_FILENAME, factionName + " [COMPLETE]\n" , "a" )
      await ns.write( FACTION_REPORT_FILENAME, "=======================================================================================================\n" , "a" )

    }
    else if ( isMember )
    {
      ns.tprint( "=======================================================================================================" )
      ns.tprint( factionName + " [JOINED]" + " [" + Math.round(progressFrac * 100) + "% COMPLETE] " + "[REPUTATION " + AddCommasToNumber(clampedRep) + " of " + AddCommasToNumber(clampedMaxRep) + "]")
      ns.tprint( "=======================================================================================================" )
    
      await ns.write( FACTION_REPORT_FILENAME, "=======================================================================================================\n" , "a" )
      await ns.write( FACTION_REPORT_FILENAME, factionName + " [JOINED]" + " [" + Math.round(progressFrac * 100) + "% COMPLETE] " + "[REPUTATION " + AddCommasToNumber(clampedRep) + " of " + AddCommasToNumber(clampedMaxRep) + "]\n" , "a" )
      await ns.write( FACTION_REPORT_FILENAME, "=======================================================================================================\n" , "a" )
    }
    else if ( isInvited )
    {
      ns.tprint( "=======================================================================================================" )
      ns.tprint( factionName + " [INVITED]" + " [" + Math.round(progressFrac * 100) + "% COMPLETE] " + "[REPUTATION " + AddCommasToNumber(clampedRep) + " of " + AddCommasToNumber(clampedMaxRep) + "]")
      ns.tprint( "=======================================================================================================" )
    
      await ns.write( FACTION_REPORT_FILENAME, "=======================================================================================================\n" , "a" )
      await ns.write( FACTION_REPORT_FILENAME, factionName + " [INVITED]" + " [" + Math.round(progressFrac * 100) + "% COMPLETE] " + "[REPUTATION " + AddCommasToNumber(clampedRep) + " of " + AddCommasToNumber(clampedMaxRep) + "]\n" , "a" )
      await ns.write( FACTION_REPORT_FILENAME, "=======================================================================================================\n" , "a" )
    }
    else
    {
      ns.tprint( "=======================================================================================================" )
      ns.tprint( factionName + " [" + Math.round(progressFrac * 100) + "% COMPLETE] " + "[REPUTATION " + AddCommasToNumber(clampedRep) + " of " + AddCommasToNumber(clampedMaxRep) + "]")
      ns.tprint( "=======================================================================================================" )
    
      await ns.write( FACTION_REPORT_FILENAME, "=======================================================================================================\n" , "a" )
      await ns.write( FACTION_REPORT_FILENAME, factionName + " [" + Math.round(progressFrac * 100) + "% COMPLETE] " + "[REPUTATION " + AddCommasToNumber(clampedRep) + " of " + AddCommasToNumber(clampedMaxRep) + "]\n" , "a" )
      await ns.write( FACTION_REPORT_FILENAME, "=======================================================================================================\n" , "a" )
    }

    const playerRequirements = ns.singularity.getFactionInviteRequirements( factionName )

    ns.tprint( FACTION_TOP_LEVEL_INDENT_STRING + FACTION_REQUIREMENTS_HEADER )
    await ns.write( FACTION_REPORT_FILENAME, FACTION_TOP_LEVEL_INDENT_STRING + FACTION_REQUIREMENTS_HEADER + "\n" , "a" )

    PrintFactionPlayerRequirements( ns, playerRequirements, isMemberOrInvited )

    //ns.tprint( "  AUGMENTATIONS:" )

    let augmentSortHash = {}

    let factionAugmentations = ns.singularity.getAugmentationsFromFaction( factionName )
    for ( let augmentIndex = 0; augmentIndex < factionAugmentations.length; augmentIndex++ )
    {
      const augmentationName = factionAugmentations[ augmentIndex ]
      if ( !(augmentationName in augmentSortHash) )
      {
        if ( installedPlayerAugmentations.includes( augmentationName ) )
        {
          augmentSortHash[ augmentationName ] = 0.0
        }
        else if ( purchasedPlayerAugmentations.includes( augmentationName ) )
        {
          augmentSortHash[ augmentationName ] = 0.25
        }
        else
        {
          const augmentPrice = ns.singularity.getAugmentationPrice( augmentationName )
          const augmentRep   = ns.singularity.getAugmentationRepReq( augmentationName )

          if ( augmentRep > factionRep )
            augmentSortHash[ augmentationName ] = 0.5
          else if ( availableFunds >= augmentPrice )
            augmentSortHash[ augmentationName ] = 1.0
          else
            augmentSortHash[ augmentationName ] = 0.75
        }
      }
    }

    factionAugmentations.sort( (augA, augB) => augmentSortHash[ augB ] - augmentSortHash[ augA ] )

    const maxLineLength = FACTION_MAX_INSERT_SPACES * 3
    let currentLineString = ""
    let nextLineString = ""
    let hasPrintedUnpurchasedSection = false
    let hasPrintedPurchasedSection = false
    let isUnpurchasedDoubleWide = false
    let isPurchasedDoubleWide = false
    let entriesOnCurrentLine = 0
    for ( let augmentIndex = 0; augmentIndex < factionAugmentations.length; augmentIndex++ )
    {
      const augmentationName = factionAugmentations[ augmentIndex ]

      const factionRestricted = factionRestrictedAugments.includes( augmentationName )

      let insertString = factionRestricted == true ? "[UNIQUE]-" : ""

      const insertSpaces = ( FACTION_MAX_INSERT_SPACES - augmentationName.length ) - insertString.length

      let insertCount = 0
      while ( insertCount < insertSpaces )
      {
        insertString = "-" + insertString
        insertCount++
      }

      if ( installedPlayerAugmentations.includes( augmentationName ) )
      {

        if (!hasPrintedUnpurchasedSection)
        {
          if ( currentLineString.length )
          {
            if ( isUnpurchasedDoubleWide )
              ns.tprint( FACTION_TOP_LEVEL_INDENT_STRING + FACTION_UNAQUIRED_AUGMENT_HEADER_DOUBLE_WIDE )
            else
              ns.tprint( FACTION_TOP_LEVEL_INDENT_STRING + FACTION_UNAQUIRED_AUGMENT_HEADER )

            ns.tprint( currentLineString )
            currentLineString = ""
          }

          hasPrintedUnpurchasedSection = true
            
        }

        nextLineString += augmentationName + insertString + "[INSTALLED]"

        if ( hasPrintedUnpurchasedSection && !hasPrintedPurchasedSection )
        {

          if ( currentLineString != "" )
            ns.tprint( currentLineString )

          entriesOnCurrentLine = nextLineString.length ? 1 : 0
          currentLineString = (FACTION_FIRST_LINE_ENTRY_OWNED_AUGMENT_INDENT_STRING + nextLineString)
          nextLineString = ""

          isPurchasedDoubleWide = augmentIndex < factionAugmentations.length - 1

          //Attempt to print header if we have not done so.
          if ( !hasPrintedPurchasedSection )
          {

            hasPrintedPurchasedSection = true

            if ( isPurchasedDoubleWide )
            {
              ns.tprint( FACTION_TOP_LEVEL_INDENT_STRING + FACTION_OWNED_AUGMENT_HEADER_DOUBLE_WIDE )
              await ns.write( FACTION_REPORT_FILENAME, FACTION_TOP_LEVEL_INDENT_STRING + FACTION_OWNED_AUGMENT_HEADER_DOUBLE_WIDE + "\n" , "a" )
            }
            else
            {
              ns.tprint( FACTION_TOP_LEVEL_INDENT_STRING + FACTION_OWNED_AUGMENT_HEADER )
              await ns.write( FACTION_REPORT_FILENAME, FACTION_TOP_LEVEL_INDENT_STRING + FACTION_OWNED_AUGMENT_HEADER + "\n" , "a" )
            }
              
          }
        }
        else if ( currentLineString.length + nextLineString.length <= maxLineLength )
        {
          currentLineString += currentLineString.length == 0 ? (FACTION_FIRST_LINE_ENTRY_OWNED_AUGMENT_INDENT_STRING + nextLineString) : (FACTION_SUBSEQUENT_LINE_ENTRY_OWNED_AUGMENT_INDENT_STRING + nextLineString)          
          nextLineString = ""
          entriesOnCurrentLine++
          isPurchasedDoubleWide = entriesOnCurrentLine > 1 ? true : false
        }
        else
        {
          ns.tprint( currentLineString )
          await ns.write( FACTION_REPORT_FILENAME, currentLineString + "\n" , "a" )

          entriesOnCurrentLine = nextLineString.length ? 1 : 0
          currentLineString = (FACTION_FIRST_LINE_ENTRY_OWNED_AUGMENT_INDENT_STRING + nextLineString)
          nextLineString = ""
        }
      }
      else if ( purchasedPlayerAugmentations.includes( augmentationName ) )
      {

        if (!hasPrintedUnpurchasedSection)
        {

          if ( currentLineString.length )
          {

            if ( isUnpurchasedDoubleWide )
            {
              ns.tprint( FACTION_TOP_LEVEL_INDENT_STRING + FACTION_UNAQUIRED_AUGMENT_HEADER_DOUBLE_WIDE )
              await ns.write( FACTION_REPORT_FILENAME, FACTION_TOP_LEVEL_INDENT_STRING + FACTION_UNAQUIRED_AUGMENT_HEADER_DOUBLE_WIDE + "\n" , "a" )
            }
            else
            {
              ns.tprint( FACTION_TOP_LEVEL_INDENT_STRING + FACTION_UNAQUIRED_AUGMENT_HEADER )
              await ns.write( FACTION_REPORT_FILENAME, FACTION_TOP_LEVEL_INDENT_STRING + FACTION_UNAQUIRED_AUGMENT_HEADER + "\n" , "a" )
            }
              
            ns.tprint( currentLineString )
            await ns.write( FACTION_REPORT_FILENAME, currentLineString + "\n" , "a" )

            currentLineString = ""
          }

          hasPrintedUnpurchasedSection = true
            
        }

        nextLineString += augmentationName + insertString + "[PURCHASED]"

        if ( hasPrintedUnpurchasedSection && !hasPrintedPurchasedSection )
        {

          if ( currentLineString != "" )
          {
            ns.tprint( currentLineString )
            await ns.write( FACTION_REPORT_FILENAME, currentLineString + "\n" , "a" )
          }
            
            
          entriesOnCurrentLine = nextLineString.length ? 1 : 0
          currentLineString = (FACTION_FIRST_LINE_ENTRY_OWNED_AUGMENT_INDENT_STRING + nextLineString)
          nextLineString = ""

          isPurchasedDoubleWide = augmentIndex < factionAugmentations.length - 1

          //Attempt to print header if we have not done so.
          if ( !hasPrintedPurchasedSection )
          {

            hasPrintedPurchasedSection = true

            if ( isPurchasedDoubleWide )
            {
              ns.tprint( FACTION_TOP_LEVEL_INDENT_STRING + FACTION_OWNED_AUGMENT_HEADER_DOUBLE_WIDE )
              await ns.write( FACTION_REPORT_FILENAME, FACTION_TOP_LEVEL_INDENT_STRING + FACTION_OWNED_AUGMENT_HEADER_DOUBLE_WIDE + "\n" , "a" )
            }
            else
            {
              ns.tprint( FACTION_TOP_LEVEL_INDENT_STRING + FACTION_OWNED_AUGMENT_HEADER )
              await ns.write( FACTION_REPORT_FILENAME, FACTION_TOP_LEVEL_INDENT_STRING + FACTION_OWNED_AUGMENT_HEADER + "\n" , "a" )
            }
              
          }
        }
        else if ( currentLineString.length + nextLineString.length <= maxLineLength )
        {
          currentLineString += currentLineString.length == 0 ? (FACTION_FIRST_LINE_ENTRY_OWNED_AUGMENT_INDENT_STRING + nextLineString) : (FACTION_SUBSEQUENT_LINE_ENTRY_OWNED_AUGMENT_INDENT_STRING + nextLineString)          
          nextLineString = ""
          entriesOnCurrentLine++
          isPurchasedDoubleWide = entriesOnCurrentLine > 1 ? true : false
        }
        else
        {
          ns.tprint( currentLineString )
          await ns.write( FACTION_REPORT_FILENAME, currentLineString + "\n" , "a" )

          entriesOnCurrentLine = nextLineString.length ? 1 : 0
          currentLineString = (FACTION_FIRST_LINE_ENTRY_OWNED_AUGMENT_INDENT_STRING + nextLineString)
          nextLineString = ""
        }
      }
      else
      {
        const augmentPrice  = ns.singularity.getAugmentationPrice( augmentationName )
        const augmentRep    = ns.singularity.getAugmentationRepReq( augmentationName )
        const augmentPreReq = ns.singularity.getAugmentationPrereq( augmentationName )

        let hasPreReq = true
        for ( let i = 0; i < augmentPreReq.length; i++ )
        {
          const requiredAugment = augmentPreReq[ i ]
          if ( !allPlayerAugmentations.includes( requiredAugment ) )
            hasPreReq = false
        }

        if ( !hasPreReq )
          nextLineString += augmentationName + insertString + "[MISS. REQ]"
        else if ( augmentRep > factionRep )
          nextLineString += augmentationName + insertString + "[NEEDS REP]"
        else if ( availableFunds >= augmentPrice )
          nextLineString += augmentationName + insertString + "[AVAILABLE]"
        else
          nextLineString += augmentationName + insertString + "[NEED CASH]"

        if ( currentLineString.length + nextLineString.length <= maxLineLength )
        {
          currentLineString += currentLineString.length == 0 ? (FACTION_FIRST_LINE_ENTRY_UNOWNED_AUGMENT_INDENT_STRING + nextLineString) : (FACTION_SUBSEQUENT_LINE_ENTRY_UNOWNED_AUGMENT_INDENT_STRING + nextLineString)          
          nextLineString = ""
          entriesOnCurrentLine++
          isUnpurchasedDoubleWide = entriesOnCurrentLine > 1 ? true : false
        }
        else
        {
          isUnpurchasedDoubleWide = entriesOnCurrentLine > 1 ? true : false

          if ( !hasPrintedUnpurchasedSection )
          {
            hasPrintedUnpurchasedSection = true

            if ( isUnpurchasedDoubleWide )
            {
              ns.tprint( FACTION_TOP_LEVEL_INDENT_STRING + FACTION_UNAQUIRED_AUGMENT_HEADER_DOUBLE_WIDE )
              await ns.write( FACTION_REPORT_FILENAME, FACTION_TOP_LEVEL_INDENT_STRING + FACTION_UNAQUIRED_AUGMENT_HEADER_DOUBLE_WIDE + "\n" , "a" )
            } 
            else
            {
              ns.tprint( FACTION_TOP_LEVEL_INDENT_STRING + FACTION_UNAQUIRED_AUGMENT_HEADER )
              await ns.write( FACTION_REPORT_FILENAME, FACTION_TOP_LEVEL_INDENT_STRING + FACTION_UNAQUIRED_AUGMENT_HEADER + "\n" , "a" )
            }  
          }

          ns.tprint( currentLineString )
          await ns.write( FACTION_REPORT_FILENAME, currentLineString + "\n" , "a" )

          entriesOnCurrentLine = nextLineString.length ? 1 : 0
          currentLineString = (FACTION_FIRST_LINE_ENTRY_UNOWNED_AUGMENT_INDENT_STRING + nextLineString)
          nextLineString = ""
        }
      }

    }

    if ( currentLineString.length > 0 )
    {
      if ( currentLineString != "" )
      {
        ns.tprint( currentLineString )
        await ns.write( FACTION_REPORT_FILENAME, currentLineString + "\n" , "a" )

        entriesOnCurrentLine = 0
      }
      
    }
      

  }

}

function ScrapeFactionsFromAugments( ns, knownFactions )
{
  /*
  To Do: We don't need to go through all augmentations, because "NeuroFlux Governor" is shared by all factions.
  We should be able to use this one single augmentation to get all factions, without having to waste cycles.
  */

  let factionRestrictedAugments = Array()
  let scrapedFactions = knownFactions.slice()
  for ( let factionIndex = 0; factionIndex < knownFactions.length; factionIndex++ )
  {
    const factionName = knownFactions[ factionIndex ]
    const augmentationList = ns.singularity.getAugmentationsFromFaction( factionName )

    for ( let augmentIndex = 0; augmentIndex < augmentationList.length; augmentIndex++ )
    {
      const augmentationName = augmentationList[ augmentIndex ]
      const factionsWithAugmentation = ns.singularity.getAugmentationFactions( augmentationName )

      if ( factionsWithAugmentation.length == 1 )
        factionRestrictedAugments.push( augmentationName )

      //Note: This might cause bugs, but it seems like it saves us cycles once we have all the factions.
      //if ( factionsWithAugmentation.length == scrapedFactions.length )
      //break

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

  const factionScrapeData = new FactionScrapeData( scrapedFactions, factionRestrictedAugments )

  return factionScrapeData

}

function PrintFactionPlayerRequirements( ns, requirements, isMemberOrInvited )
{

  const player = ns.getPlayer()
  const availableFunds = ns.getServerMoneyAvailable( "home" )

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
        const conditionType = requirement[ "type" ]

        const serverData = ns.getServer( requirement[ key ] )

        const completed = serverData.backdoorInstalled
        const printString = FormatString( conditionType ) + ": " + requirement[ key ]

        PrintRequirementWithCompletionState( ns, printString, completed )      

        //ns.tprint( "    " + FormatString( conditionType ) + ": " + requirement[ key ] )
      }
      else if ( key == "skills" )
      {
        const skillKeys = Object.keys( requirement[ key ] )
        for ( let skillIndex = 0; skillIndex < skillKeys.length; skillIndex++ )
        {
          const skillKey = skillKeys[ skillIndex ]

          const playerSkillValue = player.skills[ skillKey ]
          let completed = false

          if ( requirement[ key ][ skillKey ] <= playerSkillValue )
            completed = true

          if ( isMemberOrInvited )
            completed = true

          const printString = FormatString( skillKey ) + ": " + requirement[ key ][ skillKey ]
          PrintRequirementWithCompletionState( ns, printString, completed )
            
        }
      }
      else if ( key == "company" )
      {
        const conditionType = requirement[ "type" ]
        
        let conditionTypeString = ""
        let completed = false
        if ( "employedBy" == conditionType )
        {
          conditionTypeString = "Employed By: " + requirement[ key ]
          completed = isMemberOrInvited || requirement[ key ] in player.jobs
        }
          
        if ( "companyReputation" == conditionType )
        {
          conditionTypeString = (requirement[ key ] + " Reputation: " + requirement[ "reputation" ])
          completed = isMemberOrInvited || ns.singularity.getCompanyRep( requirement[ key ] ) > requirement[ "reputation" ]
        }
          

        PrintRequirementWithCompletionState( ns, conditionTypeString, completed )

        //ns.tprint( "    " + conditionTypeString )

      }
      else if ( key == "conditions" )
      {
        PrintFactionPlayerRequirements( ns, requirement[ key ], isMemberOrInvited )
      }
      else if ( key == "condition" )
      {
        const conditionTarget = requirement[ key ]
        const flag            = requirement[ "type" ]
        const criteria        = requirement[ key ][ "type" ]

        const conditionKeys = Object.keys( conditionTarget )
        for( let conditionKeyIndex = 0; conditionKeyIndex < conditionKeys.length; conditionKeyIndex++ )
        {
          const conditionKey = conditionKeys[ conditionKeyIndex ]

          if ( conditionKey == "type" )
            continue

          const completed = EvaluateConditionForCompletion( ns, flag, criteria, conditionTarget[ conditionKey ] )
          const printString = FormatString( flag ) + " " + FormatString( criteria ) + ": " + conditionTarget[ conditionKey ]
          PrintRequirementWithCompletionState( ns, printString, completed )
        }
      }
      else
      {
        let completed = false
        if ( key == "money" )
        {
          completed = availableFunds >= requirement[ key ]
        }
        else if ( key == "city" )
        {
          completed = isMemberOrInvited ? true : player.city == requirement[ key ]
        }
        else if ( key == "karma" )
        {
          completed = player.karma <= requirement[ key ]
        }
        else if ( key == "numPeopleKilled" )
        {
          completed = player.numPeopleKilled >= requirement[ key ]
        }
        else if ( key == "numAugmentations" )
        {
          completed = ns.singularity.getOwnedAugmentations().length >= requirement[ key ]
        }
        else if ( key == "hacknetLevels" )
        {
          const hacknodeCount = ns.hacknet.numNodes()
          let totalLevels = 0
          for ( let i = 0; i < hacknodeCount; i++ )
          {
            const nodeStats = ns.hacknet.getNodeStats( i )
            totalLevels += nodeStats.level
          }

          completed = totalLevels >= requirement[ key ]
        }
        else if ( key == "hacknetRAM" )
        {
          const hacknodeCount = ns.hacknet.numNodes()
          let totalRam = 0
          for ( let i = 0; i < hacknodeCount; i++ )
          {
            const nodeStats = ns.hacknet.getNodeStats( i )
            totalRam += nodeStats.ram
          }

          completed = totalRam >= requirement[ key ]
        }
        else if ( key == "hacknetCores" )
        {
          const hacknodeCount = ns.hacknet.numNodes()
          let totalCores = 0
          for ( let i = 0; i < hacknodeCount; i++ )
          {
            const nodeStats = ns.hacknet.getNodeStats( i )
            totalCores += nodeStats.cores
          }

          completed = totalCores >= requirement[ key ]
        }
        else if ( key == "jobTitle" )
        {
          const values = Object.values( player.jobs )
          completed = isMemberOrInvited || values.includes( requirement[ "jobTitle" ] )
        }

        const printString = FormatString( key ) + ": " + requirement[ key ]

        PrintRequirementWithCompletionState( ns, printString, completed )

        //ns.tprint( "    " + FormatString( key ) + ": " + requirement[ key ] )
      }
    } 
  }
}

async function PrintRequirementWithCompletionState( ns, printString, completed )
{

  const insertSpaces = FACTION_MAX_INSERT_SPACES - printString.length

    let insertString = ""
    let insertCount = 0
    while ( insertCount < insertSpaces )
    {
      insertString += "-"
      insertCount++
    }

  if ( completed )
  {
    ns.tprint( FACTION_REQUIREMENT_INDENT_STRING + printString + insertString + "[COMPLETED]" )
    await ns.write( FACTION_REPORT_FILENAME, FACTION_REQUIREMENT_INDENT_STRING + printString + insertString + "[COMPLETED]\n" , "a" )
  }
  else
  {
    ns.tprint( FACTION_REQUIREMENT_INDENT_STRING + printString + insertString + "[INCOMPLETE]" )
    await ns.write( FACTION_REPORT_FILENAME, FACTION_REQUIREMENT_INDENT_STRING + printString + insertString + "[INCOMPLETE]\n" , "a" )
  }
}

function EvaluateConditionForCompletion( ns, flag, criteria, conditionTarget )
{
  const player = ns.getPlayer()

  if ( criteria == "employedBy" )
  {
    let employedByTarget = false
    if ( conditionTarget in player.jobs )
    {
      employedByTarget = true
    }

    if ( flag == "not" )
      return !employedByTarget

    return employedByTarget

  }

  return false
}

function FormatString( string )
{
  if ( string == "agility" )
    return "Agility"

  if ( string == "backdoorInstalled" )
    return "Server Backdoor"

  if ( string == "city" )
    return "City"

  if ( string == "defense" )
    return "Defense"

  if ( string == "dexterity" )
    return "Dexterity"

  if ( string == "employedBy" )
    return "Employed By"

  if ( string == "hacking" )
    return "Hacking"

  if ( string == "hacknetCores" )
    return "Hacknet Cores"

  if ( string == "hacknetLevels" )
    return "Hacknet Levels"

  if ( string == "hacknetRAM" )
    return "Hacknet RAM"

  if ( string == "jobTitle" )
    return "Job Title"

  if ( string == "karma" )
    return "Karma"

  if ( string == "money" )
    return "Money"

  if ( string == "not" )
    return "Not"

  if ( string == "numAugmentations" )
    return "Augmentations"

  if ( string == "numPeopleKilled" )
    return "Homicides"

  if ( string == "strength" )
    return "Strength"

  return string
}