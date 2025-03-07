/** @param {NS} ns */
export async function main(ns) {
  // Defines the "target server", which is the server
  const target = ns.args[0]

  ns.print( "Target Host: " + target )

  // Defines the minimum security level the target server can
  // have. If the target's security level is higher than this,
  // we'll weaken it before doing anything else
  const securityThresh = ns.getServerMinSecurityLevel(target);

  // Infinite loop that continously hacks/grows/weakens the target server
  while(true) 
  {
      if (ns.getServerSecurityLevel(target) > securityThresh)
      {
        await ns.weaken(target);
      }
      
      return

  }
}