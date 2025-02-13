import { SearchNetworkForFilesWithExtension } from "utility.js"
import { FindFirstServerWithFile } from "utility.js"

import { SolveEncryptionII } from "EncryptionII-Solver.js"

/** @param {NS} ns */
export async function main(ns) {

  const fileExtension = ".cct"

  const contracts = SearchNetworkForFilesWithExtension( ns, "home", "home", fileExtension, false )

  for ( let i = 0; i < contracts.length; i++ )
  {
    const contract = contracts[i]

    //HACK: THIS IS A FULL NETWORK SEARCH AND IS SUPER INEFFICIENT, WE SHOULDN'T DO THIS.
    const contractHost = FindFirstServerWithFile( ns, "home", "home", contract)

    if ( contractHost == "" )
      continue

    const type = ns.codingcontract.getContractType( contract, contractHost )

    GetSolutionForContractType( ns, type, contract, contractHost )

  }
}

function GetSolutionForContractType( ns, type, contract, contractHost )
{

  switch ( type )
  {
    case "Encryption II: Vigenère Cipher":

      const data = ns.codingcontract.getData( contract, contractHost)
      const solution = SolveEncryptionII( ns, data[0], data[1] )

      const success = ns.codingcontract.attempt( solution, contract, contractHost )

      if ( success )
        ns.tprint( "Solved contract: " + contract )
      else
        ns.tprint( "Failed to solve contract: " + contract + " check Encryption II: Vigenère Cipher solution EncryptionII-Solver.js" )


    break
  }
  

}