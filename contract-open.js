import { FindFirstServerWithFile } from "utility.js"

/** @param {NS} ns */
export async function main(ns) 
{

  const fileName = ns.args[0]

  const serverWithFile = FindFirstServerWithFile( ns, "home", "home", fileName )

  if ( serverWithFile != "" )
  {
    const description = ns.codingcontract.getDescription( fileName, serverWithFile )
    ns.tprint( description )
  }
  else
  {
    ns.tprint( "Contract " + fileName + " was not found on the network, please check name and try again." )
  }

}