/** @param {NS} ns */
export async function main(ns) {
  // Defines the "target server", which is the server
  const target = ns.args[0]

  ns.print( "Target Host: " + target )

  // Defines how much money a server should have before we hack it
  // In this case, it is set to the maximum amount of money.
  const moneyThresh = ns.getServerMaxMoney(target);

  // Infinite loop that continously hacks/grows/weakens the target server
  while(true) 
  {
    //To Do: Pass in how many threads are targeting this server so we know how much hacking to do.
    if (ns.getServerMoneyAvailable(target) == moneyThresh)
    {
      await ns.hack(target);
    }
    
    return

  }
}