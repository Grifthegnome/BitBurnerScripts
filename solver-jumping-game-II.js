/*
You are given the following array of integers:

 1,5,1,2,3,2,0,4,2,5,1,3,2,1,1

 Each element in the array represents your MAXIMUM jump length at that position. This means that if you are at position i and your maximum jump length is n, you can jump to any position from i to i+n. 

Assuming you are initially positioned at the start of the array, determine the minimum number of jumps to reach the end of the array.

 If it's impossible to reach the end, then the answer should be 0.
*/

export async function main(ns) 
{
  const jumpString = ns.args[0]

  let jumpArray = Array()
  for ( let i = 0; i < jumpString.length; i++ )
  {
    if ( jumpString[i] != "," )
      jumpArray.push( Number( jumpString[i] ) )
  }

  const result = SolveJumpingGame( jumpArray )

   ns.tprint( result )

  return result
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

  if ( jumpArray.length <= 0 )
    return 0

  let currentJumpTree = Array()
  currentJumpTree.push( 0 )

  let possibleJumps = BuildIndexArrayForJump( jumpArray, 0 )

  let smallestJumpCount = jumpArray.length + 1

  let newSmallestJumpCount = BuildAndEvaluateJumpTree( jumpArray, currentJumpTree, possibleJumps, smallestJumpCount )

  if ( smallestJumpCount == newSmallestJumpCount )
    return 0
    
  return newSmallestJumpCount

}

function BuildAndEvaluateJumpTree( jumpArray, currentJumpTree, possibleJumps, smallestJumpCount )
{
  let newSmallestJumpCount = smallestJumpCount
  for ( let i = 0; i < possibleJumps.length; i++ )
  {
    /*
    From our current position we need to get all possible jumps.
    We then need to follow each jump chain to it's conclusion to determine if it reaches the end of the jump array.
    If it does, we need to see if the total number of jumps is better than our current count.
    */

    let nextJumpTree = currentJumpTree.slice()
    nextJumpTree.push( possibleJumps[i] )

    if ( possibleJumps[i] + jumpArray[ possibleJumps[i] ] >= jumpArray.length )
    {
      if ( nextJumpTree.length < newSmallestJumpCount )
        newSmallestJumpCount = nextJumpTree.length
      
      continue
    }
 
    let nextPossibleJumps = BuildIndexArrayForJump( jumpArray, possibleJumps[i] )

    nextPossibleJumps.sort( (jumpIndexA, jumpIndexB) => jumpArray[jumpIndexB] - jumpArray[jumpIndexA] )

    //We need to check if the jump tree has reached the end of the jump array and then see if the number of jumps is less than our best current jump count.

    let subTreeSmallestJumpCount = BuildAndEvaluateJumpTree( jumpArray, nextJumpTree, nextPossibleJumps, smallestJumpCount )

    if ( subTreeSmallestJumpCount < newSmallestJumpCount )
      newSmallestJumpCount = subTreeSmallestJumpCount

  }

  return newSmallestJumpCount
}

function BuildIndexArrayForJump( jumpArray, startIndex )
{
  if ( startIndex >= jumpArray.length )
    console.error("Invalid indices")

  const maxJumpLength = jumpArray[startIndex]

  let validJumpIndices = Array()

  for ( let i = 1; i <= maxJumpLength; i++ )
  {
    if ( startIndex + i >= jumpArray.length )
      continue

    //If the index has a jump length of 0, skip it.
    if ( jumpArray[ startIndex + i ] == 0 )
      continue

    validJumpIndices.push( startIndex + i )
  }

  return validJumpIndices

}