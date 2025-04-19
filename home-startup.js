/** @param {NS} ns */
export async function main(ns) 
{
  ns.exec( "home-cleanup.js", "home" )

  await ns.sleep(1000)

  ns.exec( "R-NUKE.js", "home" )
  ns.exec( "pig-hunt-4.0.js", "home" )
  ns.exec( "pserv-manager.js", "home" )
  ns.exec( "hacknet-manager.js", "home" )
  ns.exec( "darkweb-manager.js", "home" )
  ns.exec( "gang-manager.js", "home" )
}