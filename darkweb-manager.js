/** @param {NS} ns */
export async function main(ns) 
{
  if ( !(ns.singularity) )
  {
    ns.tprint( "You don't have access to the singularity API." )
    ns.tprint( "Terminating script." )
    return
  }
  
  //Not a complete list, only the ones we care about and haven't replaced with our own scripts.
  const darkwebPrograms = [ 
    "BruteSSH.exe",
    "FTPCrack.exe",
    "relaySMTP.exe",
    "HTTPWorm.exe",
    "SQLInject.exe",
    "Formulas.exe"
    ]

  while ( true )
  {

    const availableFunds = ns.getServerMoneyAvailable( "home" )
    let hasAllPrograms = true

    if ( ns.singularity.purchaseTor() )
    {
      //const darkwebPrograms = ns.singularity.getDarkwebPrograms()

      for ( let i = 0; i < darkwebPrograms.length; i++ )
      {
        const program = darkwebPrograms[i]

        if ( !ns.fileExists(program, "home") )
        {

          hasAllPrograms = false

          const cost = ns.singularity.getDarkwebProgramCost( program )

          if ( cost <= availableFunds )
          {
            if ( ns.singularity.purchaseProgram( program ) )
              ns.exec( "R-NUKE.js", "home" )
          }
        }
      }
    }

    if ( hasAllPrograms == true )
    {
      ns.tprint( "All Darkweb Programs Purchased, Exiting Manager." )
      return
    }

    await ns.sleep( 1000 )
  }

}
//# sourceURL=home/darkweb-manager.js