/** @param {NS} ns */
export async function main(ns) 
{

  if ( !(ns.singularity) )
  {
    ns.tprint( "You don't have access to the singularity API." )
    ns.tprint( "Terminating script." )
    return
  }

  let augmentationName = ""
  if ( ns.args.length > 1 )
  {
    for ( let i = 0; i < ns.args.length; i++ )
    {
      const augmentNameSegment = ns.args[i]
      if ( i != ns.args.length - 1 )
      {
        augmentationName += (augmentNameSegment + " ")
      }
      else
      {
        augmentationName += augmentNameSegment
      }
    }
  }
  else
  {
    augmentationName = ns.args[0]
  }
  

  const augmentStats = ns.singularity.getAugmentationStats( augmentationName )

  ns.tprint("======================================")
  ns.tprint( augmentationName )
  ns.tprint("======================================")

  //Stats
  if ( augmentStats.hacking > 1 )
    ns.tprint( ConvertPositiveValueToPercent(  augmentStats.hacking ) + " hacking skill"  )

  if ( augmentStats.hacking_exp > 1 )
    ns.tprint( ConvertPositiveValueToPercent(  augmentStats.hacking_exp ) + " hacking exp" )

  if ( augmentStats.hacking_chance > 1 )
    ns.tprint( ConvertPositiveValueToPercent(  augmentStats.hacking_chance ) + " hack() success chance"  )

  if ( augmentStats.hacking_grow > 1 )
    ns.tprint( ConvertPositiveValueToPercent(  augmentStats.hacking_grow ) + " hacking grow"  )

  if ( augmentStats.hacking_money > 1 )
    ns.tprint( ConvertPositiveValueToPercent(  augmentStats.hacking_money ) + " hack() power" )

  if ( augmentStats.hacking_speed > 1 )
    ns.tprint( ConvertPositiveValueToPercent( augmentStats.hacking_speed ) + " faster hack(), grow(), and weaken()" )

  if ( augmentStats.strength > 1 )
    ns.tprint( ConvertPositiveValueToPercent(  augmentStats.strength ) + " strength skill" )

  if ( augmentStats.strength_exp > 1 )
    ns.tprint( ConvertPositiveValueToPercent(  augmentStats.strength_exp ) + " strength exp" )

  if ( augmentStats.defense > 1 )
    ns.tprint( ConvertPositiveValueToPercent(  augmentStats.defense ) + " defense skill"  )

  if ( augmentStats.defense_exp > 1 )
    ns.tprint( ConvertPositiveValueToPercent(  augmentStats.defense_exp ) + " defense exp" )

  if ( augmentStats.dexterity > 1 )
    ns.tprint( ConvertPositiveValueToPercent(  augmentStats.dexterity ) + " dexterity skill"  )

  if ( augmentStats.dexterity_exp > 1 )
    ns.tprint( ConvertPositiveValueToPercent(  augmentStats.dexterity_exp ) + " dexterity exp" )

  if ( augmentStats.agility > 1 )
    ns.tprint( ConvertPositiveValueToPercent( augmentStats.agility ) + " agility skill"  )

  if ( augmentStats.agility_exp > 1 )
    ns.tprint( ConvertPositiveValueToPercent( augmentStats.agility_exp ) + " agility exp" )
  
  if ( augmentStats.charisma > 1 )
    ns.tprint( ConvertPositiveValueToPercent( augmentStats.charisma ) + " charisma skill"  )

  if ( augmentStats.charisma_exp > 1 )
    ns.tprint( ConvertPositiveValueToPercent(  augmentStats.charisma_exp ) + " charisma exp" )
  

  //Crime
  if ( augmentStats.crime_money > 1 )
    ns.tprint( ConvertPositiveValueToPercent(  augmentStats.crime_money ) + " crime money" )

  if ( augmentStats.crime_success > 1 )
    ns.tprint( ConvertPositiveValueToPercent( augmentStats.crime_success ) + " crime success chance" )

  //Faction
  if ( augmentStats.faction_rep > 1 )
    ns.tprint( ConvertPositiveValueToPercent(  augmentStats.faction_rep ) + " reputation from factions" )

  //Company
  if ( augmentStats.company_rep > 1 )
    ns.tprint( ConvertPositiveValueToPercent(  augmentStats.company_rep ) + " reputation from companies" )

  if ( augmentStats.work_money > 1 )
    ns.tprint( ConvertPositiveValueToPercent(  augmentStats.work_money ) + " work money" )
  
  //Hacknet
  if ( augmentStats.hacknet_node_purchase_cost < 1 )
    ns.tprint( ConvertNegativeValueToPercent( augmentStats.hacknet_node_purchase_cost ) + " hacknet purchase cost" )

  if ( augmentStats.hacknet_node_level_cost < 1 )
    ns.tprint( ConvertNegativeValueToPercent( augmentStats.hacknet_node_level_cost ) + " hacknet level cost" )

  if ( augmentStats.hacknet_node_ram_cost < 1 )
    ns.tprint( ConvertNegativeValueToPercent( augmentStats.hacknet_node_ram_cost ) + " hacknet RAM cost: "  )

  if ( augmentStats.hacknet_node_core_cost < 1 )
    ns.tprint( ConvertNegativeValueToPercent( augmentStats.hacknet_node_core_cost ) + " hacknet core cost: " )

  if ( augmentStats.hacknet_node_money > 1 )
    ns.tprint( ConvertPositiveValueToPercent(  augmentStats.hacknet_node_money ) + " hacknet money" )

  //Blade Burner
  if ( augmentStats.bladeburner_analysis > 1 )
    ns.tprint( ConvertPositiveValueToPercent( augmentStats.bladeburner_analysis ) + " bladeburner analysis" )

  if ( augmentStats.bladeburner_max_stamina > 1 )
    ns.tprint( ConvertPositiveValueToPercent( augmentStats.bladeburner_max_stamina ) + " bladeburner max stamina" )

  if ( augmentStats.bladeburner_stamina_gain > 1 )
    ns.tprint( ConvertPositiveValueToPercent(  augmentStats.bladeburner_stamina_gain ) + " bladeburner stamina gain" )

  if ( augmentStats.bladeburner_success_chance > 1 )
    ns.tprint( ConvertPositiveValueToPercent( augmentStats.bladeburner_success_chance ) + " bladeburner success chance" )


  if ( augmentationName == "CashRoot Starter Kit" )
  {
    ns.tprint( "Start with 1,00,000 after installing augmentations." )
    ns.tprint( "Start with BruteSSH.exe after installing augmentations." )
  }

  if ( augmentationName == "Neuroreceptor Management Implant" )
  {
    ns.tprint( "Removes productivity pentalty when you are not focusing on a task." )
  }

  if ( augmentationName == "The Red Pill" )
  {
    ns.tprint( "Gives you access to World Demon so you can hack it and destroy the bitnode." )
  }

}

function ConvertPositiveValueToPercent( value )
{
  return "+" + Math.round(( value - 1 ) * 100) + "%"
}

function ConvertNegativeValueToPercent( value )
{
  return -( 1 - value ).toFixed(2) * 100 + "%"
}