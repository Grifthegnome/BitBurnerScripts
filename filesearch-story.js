import { SearchNetworkForFilesWithExtension } from "utility.js"

/** @param {NS} ns */
export async function main(ns) {

  const fileExtension = ".lit"

  SearchNetworkForFilesWithExtension( ns, "home", "home", fileExtension, true )

}