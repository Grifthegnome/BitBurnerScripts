/*
You are given the following array of integers:

 1,5,1,2,3,2,0,4,2,5,1,3,2,1,1

 Each element in the array represents your MAXIMUM jump length at that position. This means that if you are at position i and your maximum jump length is n, you can jump to any position from i to i+n. 

Assuming you are initially positioned at the start of the array, determine the minimum number of jumps to reach the end of the array.

 If it's impossible to reach the end, then the answer should be 0.
*/

export async function main(ns) 
{
  const jumpArray = ns.args[0]
  const result = SolveJumpingGame( jumpArray )
}

export function SolveJumpingGame( jumpArray )
{

  //It's looking like we might have to build a tree of jumps.
  //Find all trees that reach the end of the array.
  //Return the one with the shortest length.

  /*
  Notes:
    because an array index represents the Maximum jump distance, we need to build trees for all indices
    in the jump range.
  */

  debugger

  if ( jumpArray.length <= 0 )
    return 0

  let jumpIndiceArrays = Array()
  jumpIndiceArrays.push( [0] )

  let possibleJumps = BuildArraysForJump( jumpArray, 0 )

  for ( let i = 0; i > possibleJumps.length; i++ )
  {
    let nextJumpSet = jumpIndiceArrays.slice().push( possibleJumps[i] )
    nextJumpSet.push( nextJumpSet )

  }

}

function BuildArraysForJump( jumpArray, startIndex )
{
  if ( startIndex >= jumpArray.length )
    console.error("Invalid indices")

  const maxJumpLength = jumpArray[startIndex]

  let validJumpIndices = Array()

  for ( let i = 1; i <= maxJumpLength; i++ )
  {
    if ( startIndex + i >= jumpArray.length )
      continue

    validJumpIndices.push( startIndex + i )
  }

  return validJumpIndices

}