//Reports the change in your account at regular intervals

/** @param {NS} ns */
export async function main(ns) {

  //To Do: This is really a helper function to shut down duplicates, 
  //we should make this a global utility.
  const thisScript = ns.getRunningScript()

  let processes = ns.ps( ns.getHostname() )
  for ( var i = 0; i < processes.length; i++ )
  {
    const process = processes[i]

    if ( process.filename == thisScript.filename && process.pid != thisScript.pid )
    {
      ns.kill( process.pid )
    }
  }

  const msHour = 3600000

  let lastBalance = ns.getServerMoneyAvailable( "home" )

  while ( true )
  {
    let currentBalance = ns.getServerMoneyAvailable( "home" )

    let deltaBalance = currentBalance - lastBalance

    ns.tprint( "\n" )

    if ( deltaBalance > 0 )
    {
      ns.tprint( "Account: " + deltaBalance + " dollars gained." )
    }
    else if ( deltaBalance < 0  )
    {
      ns.tprint( "Account: " + deltaBalance + " dollars lost." )
    }
    /*
    else
    {
      ns.tprint( "Account: No Change." )
    }
    */

    lastBalance = currentBalance

    //Sleep one second.
    //await ns.sleep( 1000 )
    await ns.sleep( 60000 )
  }

}