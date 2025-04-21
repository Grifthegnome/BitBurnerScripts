/** @param {NS} ns */
export async function main(ns) 
{
  //This script is run by home-startup.js to delete data from previous playthroughs.
  if ( ns.fileExists( "locked_servers.txt", "home" ) )
    ns.rm( "servers_locked.txt", "home" )

  if ( ns.fileExists( "servers_ram_prealloc.txt", "home" ) )
    ns.rm( "servers_ram_prealloc.txt", "home" )

  if ( ns.fileExists( "servers_ram_prealloc_active_keys.txt", "home" ) )
    ns.rm( "servers_ram_prealloc_active_keys.txt", "home" )

  if ( ns.fileExists( "unused_thread_report.txt", "home" ) )
    ns.rm( "unused_thread_report.txt", "home" )

  if ( ns.fileExists( "servers_compromised.txt", "home" ) )
    ns.rm( "servers_compromised.txt", "home" )

  //BLADE BURNER FILES
  if ( ns.fileExists( "bladeburner_intel_time.txt", "home" ) )
    ns.rm( "bladeburner_intel_time.txt", "home" )

  if ( ns.fileExists( "bladeburner_last_city_pop.txt", "home" ) )
    ns.rm( "bladeburner_last_city_pop.txt", "home" )

  if ( ns.fileExists( "bladeburner_city_pop_trend.txt", "home" ) )
    ns.rm( "bladeburner_city_pop_trend.txt", "home" )

  if ( ns.fileExists( "bladeburner_report.txt", "home" ) )
    ns.rm( "bladeburner_report.txt", "home" )

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