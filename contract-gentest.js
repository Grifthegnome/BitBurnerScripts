import { FindAllFilesWithExtensionOnServer } from "utility.js"

/** @param {NS} ns */
export async function main(ns) 
{
	const hostName = ns.getHostname()

	if ( hostName != "home" )
        return

	const oldDummyContracts = FindAllFilesWithExtensionOnServer( ns, hostName, ".cct", false )

	for ( let i = 0; i < oldDummyContracts.length; i++ )
	{
		const oldContract = oldDummyContracts[i]
		ns.rm( oldContract, hostName )
	}

  const contractTypes = ns.codingcontract.getContractTypes()

  for( let i = 0; i < contractTypes.length; i++ )
  {
    const type = contractTypes[i]

    const dummyContract = ns.codingcontract.createDummyContract( type )

    if (dummyContract)
        ns.tprint("Successfully created a " + type + " dummy contract " + dummyContract + " on home");
    else
        ns.tprint("Failed to create a " + type + " dummy contract on home");
  }

}