/** @param {NS} ns */
export async function main(ns) 
{

  debugger

  while ( true )
  {

    const availableFunds = ns.getServerMoneyAvailable( "home" )
    let hasAllPrograms = true


    if ( ns.singularity.purchaseTor() )
    {
      const darkwebPrograms = ns.singularity.getDarkwebPrograms()

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