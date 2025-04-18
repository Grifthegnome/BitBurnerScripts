/** @param {NS} ns */
export async function main(ns) {
  // Defines the "target server", which is the server
  const target = ns.args[0]
  const delay  = ns.args[1]

  ns.print( "Target Host: " + target )

  // Defines the minimum security level the target server can
  // have. If the target's security level is higher than this,
  // we'll weaken it before doing anything else
  
  //We want 
  await ns.sleep( 0.25 )

  const securityThresh = ns.getServerMinSecurityLevel(target);

  // Infinite loop that continously hacks/grows/weakens the target server
  while(true) 
  {
      if (ns.getServerSecurityLevel(target) > securityThresh)
      {
        const basicHWGOptions = { additionalMsec: delay }
        await ns.weaken(target, basicHWGOptions);
      }
      
      return

  }
}