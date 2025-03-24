import { SearchNetworkForFilesWithExtension } from "utility.js"
import { FindFirstServerWithFile } from "utility.js"

import { SolveEncryptionII } from "solver-encryptionII.js"
import { GenerateIPAdressesFromKey } from "solver-generate-ip.js"
import { SolveJumpingGame } from "solver-jumping-game-II.js"

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

  let data
  let solution
  let success

  switch ( type )
  {
    case "Encryption II: Vigenère Cipher":

      data = ns.codingcontract.getData( contract, contractHost)
      solution = SolveEncryptionII( ns, data[0], data[1] )

      success = ns.codingcontract.attempt( solution, contract, contractHost )

      if ( success )
        ns.tprint( "Solved contract: " + contract )
      else
        ns.tprint( "Failed to solve contract: " + contract + " check Encryption II: Vigenère Cipher solution solver-encryptionII.js" )


    break
    case "Generate IP Addresses":
      data = ns.codingcontract.getData( contract, contractHost)
      solution = GenerateIPAdressesFromKey( ns, data )

      success = ns.codingcontract.attempt( solution, contract, contractHost )

      if ( success )
        ns.tprint( "Solved contract: " + contract )
      else
        ns.tprint( "Failed to solve contract: " + contract + " check Generate IP Addresses solution solver-generate-ip.js" )

    break

    case "Array Jumping Game II":

      data = ns.codingcontract.getData( contract, contractHost )
      solution = SolveJumpingGame( data )

      success = ns.codingcontract.attempt( solution, contract, contractHost )

      if ( success )
        ns.tprint( "Solved contract: " + contract )
      else
        ns.tprint( "Failed to solve contract: " + contract + " check Jumping Game II solution solver-jumping-game-II.js" )

    break
  }
}