/** @param {NS} ns */
export async function main(ns) 
{
  const homeRunScript = ns.args[0]

  let scriptArgs = ns.args
  scriptArgs.shift()

  ns.exec( homeRunScript, "home", ...scriptArgs )
}