/** @param {NS} ns */
export async function main(ns) 
{

  if ( !(ns.singularity) )
  {
    ns.tprint( "You don't have access to the singularity API." )
    ns.tprint( "Terminating script." )
    return
  }

  const augmentationName = ns.args[0]

  const augmentStats = ns.singularity.getAugmentationStats( augmentationName )

  ns.tprint("======================================")
  ns.tprint( augmentationName )
  ns.tprint("======================================")

  //Stats
  if ( augmentStats.hacking > 1 )
    ns.tprint( "Hacking: " + ConvertPositiveValueToPercent(  augmentStats.hacking ) )

  if ( augmentStats.hacking_exp > 1 )
    ns.tprint( "Hacking Exp: " + ConvertPositiveValueToPercent(  augmentStats.hacking_exp ) )

  if ( augmentStats.hacking_chance > 1 )
    ns.tprint( "Hacking Chance: " + ConvertPositiveValueToPercent(  augmentStats.hacking_chance ) )

  if ( augmentStats.hacking_grow > 1 )
    ns.tprint( "Hacking Grow: " + ConvertPositiveValueToPercent(  augmentStats.hacking_grow ) )

  if ( augmentStats.hacking_money > 1 )
    ns.tprint( "Hacking Money: " + ConvertPositiveValueToPercent(  augmentStats.hacking_money ) )

  if ( augmentStats.hacking_speed > 1 )
    ns.tprint( "Hacking Speed: " + ConvertPositiveValueToPercent(  augmentStats.hacking_speed ) )

  if ( augmentStats.strength > 1 )
    ns.tprint( "Strength: " + ConvertPositiveValueToPercent(  augmentStats.strength ) )

  if ( augmentStats.strength_exp > 1 )
    ns.tprint( "Strength Exp: " + ConvertPositiveValueToPercent(  augmentStats.strength_exp ) )

  if ( augmentStats.defense > 1 )
    ns.tprint( "Defense: " + ConvertPositiveValueToPercent(  augmentStats.defense ) )

  if ( augmentStats.defense_exp > 1 )
    ns.tprint( "Defense Exp: " + ConvertPositiveValueToPercent(  augmentStats.defense_exp ) )

  if ( augmentStats.dexterity > 1 )
    ns.tprint( "Dexterity: " + ConvertPositiveValueToPercent(  augmentStats.dexterity ) )

  if ( augmentStats.dexterity_exp > 1 )
    ns.tprint( "Dexterity Exp: " + ConvertPositiveValueToPercent(  augmentStats.dexterity_exp ) )

  if ( augmentStats.agility > 1 )
    ns.tprint( "Agility: " + ConvertPositiveValueToPercent( augmentStats.agility ) )

  if ( augmentStats.agility_exp > 1 )
    ns.tprint( "Agility Exp: " + ConvertPositiveValueToPercent( augmentStats.agility_exp ) )
  
  if ( augmentStats.charisma > 1 )
    ns.tprint( "Charisma: " + ConvertPositiveValueToPercent( augmentStats.charisma ) )

  if ( augmentStats.charisma_exp > 1 )
    ns.tprint( "Charisma Exp: " + ConvertPositiveValueToPercent(  augmentStats.charisma_exp ) )
  

  //Crime
  if ( augmentStats.crime_money > 1 )
    ns.tprint( "Crime Money: " + ConvertPositiveValueToPercent(  augmentStats.crime_money ) )

  if ( augmentStats.crime_success > 1 )
    ns.tprint( "Crime Success: " + ConvertPositiveValueToPercent(  augmentStats.crime_success ) )

  //Faction
  if ( augmentStats.faction_rep > 1 )
    ns.tprint( "Faction Rep: " + ConvertPositiveValueToPercent(  augmentStats.faction_rep ) )

  //Company
  if ( augmentStats.company_rep > 1 )
    ns.tprint( "Company Rep: " + ConvertPositiveValueToPercent(  augmentStats.company_rep ) )

  if ( augmentStats.work_money > 1 )
    ns.tprint( "Work Money: " + ConvertPositiveValueToPercent(  augmentStats.work_money ) )
  
  //Hacknet
  if ( augmentStats.hacknet_node_purchase_cost < 1 )
    ns.tprint( "Hacknet Purchase Cost: " + -( 1 - augmentStats.hacknet_node_purchase_cost ).toFixed(2) * 100 + "%" )

  if ( augmentStats.hacknet_node_level_cost < 1 )
    ns.tprint( "Hacknet Level Cost: " + -( 1 - augmentStats.hacknet_node_level_cost ).toFixed(2) * 100 + "%" )

  if ( augmentStats.hacknet_node_ram_cost < 1 )
    ns.tprint( "Hacknet RAM Cost: " +  -( 1 - augmentStats.hacknet_node_ram_cost ).toFixed(2) * 100 + "%" )

  if ( augmentStats.hacknet_node_core_cost < 1 )
    ns.tprint( "Hacknet Core Cost: " + -( 1 - augmentStats.hacknet_node_core_cost ).toFixed(2) * 100 + "%" )

  if ( augmentStats.hacknet_node_money > 1 )
    ns.tprint( "Hacknet Money: " + Math.round(( augmentStats.hacknet_node_money - 1 ) * 100) + "%" )

  //Blade Burner
  if ( augmentStats.bladeburner_analysis > 1 )
    ns.tprint( "Bladeburner Analysis: " + ConvertPositiveValueToPercent( augmentStats.bladeburner_analysis ) )

  if ( augmentStats.bladeburner_max_stamina > 1 )
    ns.tprint( "Bladeburner Max Stamina: " + ConvertPositiveValueToPercent( augmentStats.bladeburner_max_stamina ) )

  if ( augmentStats.bladeburner_stamina_gain > 1 )
    ns.tprint( "Bladeburner Stamina Gain: " + ConvertPositiveValueToPercent(  augmentStats.bladeburner_stamina_gain ) )

  if ( augmentStats.bladeburner_success_chance > 1 )
    ns.tprint( "Bladeburner Success Chance: " + ConvertPositiveValueToPercent( augmentStats.bladeburner_success_chance ) )


  if ( augmentationName == "CashRoot Starter Kit" )
  {
    ns.tprint( "Start with 1,00,000 after installing augmentations." )
    ns.tprint( "Start with BruteSSH.exe after installing augmentations." )
  }

}

function ConvertPositiveValueToPercent( value )
{
  return Math.round(( value - 1 ) * 100) + "%"
}