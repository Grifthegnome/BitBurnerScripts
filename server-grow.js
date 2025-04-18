/** @param {NS} ns */
export async function main(ns) {
  // Defines the "target server", which is the server
  const target = ns.args[0]
  const delay  = ns.args[1]

  ns.print( "Target Host: " + target )

  // Defines how much money a server should have before we hack it
  // In this case, it is set to the maximum amount of money.
  const moneyThresh = ns.getServerMaxMoney(target);

  // Infinite loop that continously hacks/grows/weakens the target server
  while(true) 
  {
      if (ns.getServerMoneyAvailable(target) < moneyThresh) 
      {
        const basicHWGOptions = { additionalMsec: delay }
        await ns.grow(target, basicHWGOptions);
      }
      
      return

  }
}