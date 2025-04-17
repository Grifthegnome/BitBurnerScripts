/** @param {NS} ns */
export async function main(ns) 
{
  //This script is run by home-startup.js to delete data from previous playthroughs.

  //This cleans up data for hacknet-manager.js
  if ( ns.fileExists( "hacknet_cores_income_data.txt", "home" ) )
    ns.rm( "hacknet_cores_income_data.txt", "home" )

  if ( ns.fileExists( "hacknet_level_income_data.txt", "home" ) )
    ns.rm( "hacknet_level_income_data.txt", "home" )

  if ( ns.fileExists( "hacknet_ram_income_data.txt", "home" ) ) 
    ns.rm( "hacknet_ram_income_data.txt", "home" )

  if ( ns.fileExists( "hacknet_roi_report.txt", "home" ) )
    ns.rm( "hacknet_roi_report.txt", "home" )

  if ( ns.fileExists( "hacknet_spend.txt", "home" ) )
    ns.rm( "hacknet_spend.txt", "home" )
}