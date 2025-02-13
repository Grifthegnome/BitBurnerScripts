import { SearchNetworkForFilesWithExtension } from "utility.js"

/** @param {NS} ns */
export async function main(ns) {

  const fileExtension = ns.args[0]

  SearchNetworkForFilesWithExtension( ns, "home", "home", fileExtension, false )

}