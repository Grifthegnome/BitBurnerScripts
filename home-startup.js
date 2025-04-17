/** @param {NS} ns */
export async function main(ns) 
{

  if ( ns.args.length > 0 )
  {
    const clearOldData = ns.args[0]
    if ( clearOldData )
      ns.exec( "home-cleanup.js", "home" )
  }

  ns.exec( "R-NUKE.js", "home" )
  ns.exec( "pig-hunt-4.0.js", "home" )
  ns.exec( "pserv-manager.js", "home" )
  ns.exec( "hacknet-manager.js", "home" )
  ns.exec( "darkweb-manager.js", "home" )
  ns.exec( "gang-manager.js", "home" )
}