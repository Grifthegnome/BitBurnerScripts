/** @param {NS} ns */
export async function main(ns) {
    // Defines the "target server", which is the server
    const target = ns.args[0]
  
    ns.print( "Target Host: " + target )

    // Defines how much money a server should have before we hack it
    // In this case, it is set to the maximum amount of money.
    const moneyThresh = ns.getServerMaxMoney(target);
    const securityThresh = ns.getServerMinSecurityLevel(target);

    // Infinite loop that continously hacks/grows/weakens the target server
    while(true) 
    {
        if (ns.getServerSecurityLevel(target) > securityThresh) 
          await ns.weaken(target);

        else if (ns.getServerMoneyAvailable(target) < moneyThresh) 
          await ns.grow(target);
        
        //Add random wait variance so all threads aren't running at the exact same time.
        await ns.sleep( 1000 * Math.random() )
    }
}