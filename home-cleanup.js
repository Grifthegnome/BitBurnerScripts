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