/*
Given the following string containing only digits, return an array with all possible valid IP address combinations that can be created from the string:

 1162473391

 Note that an octet cannot begin with a '0' unless the number itself is exactly '0'. For example, '192.168.010.1' is not a valid IP.

 Examples:

 25525511135 -> ["255.255.11.135", "255.255.111.35"]
 1938718066 -> ["193.87.180.66"]
*/

/** @param {NS} ns */
export async function main(ns) {

  const ipKey = ns.args[0]

  const result = GenerateIPAdressesFromKey( ipKey )

}

export function GenerateIPAdressesFromKey( ipKey )
{
  /*
  What we know:
  -There are 4 segments in an IP
  -A segment cannot start with 0
  -Each segment has a max of 3 digits.
  */

  /*
  Things to consider:

  -We should check up front how many segments of what length we have in the key.
  */

  if ( typeof ipKey != String )
    ipKey = ipKey.toString()

  const fullSegmentCount = Math.floor( ipKey.length / 3 )
  const remainder = ipKey.length % 3

  //Build an ordering table? I.E.
  // 2,3,3,3
  // 3,2,3,3
  // 3,3,2,3
  // 3,3,3,2

  //Build IPs

  //Invalidate any IP's with starter 0 placements.

  //return final list?


  debugger

  let validIps = Array()

  //Do Work Here.


  return validIps


}