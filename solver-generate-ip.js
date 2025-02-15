import {ArraysAreEqual} from "utility.js"
import {ArraySwapElements} from "utility.js"

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
  -We could have ips with segments all of legth 1, 2, or 3/
  -We can't evaluate each segment individually, because we can't ensure that we fit to string length.
  */

  /*
    We have to sub-divide one of the full segments into two partial seqments to get a complete IP.
    Case Examples:
      123456789
        this needs to yield segment keys of [3,3,2,1] & [3,2,2,2]
          For [3,3,2,1] start with a divisor array and shrink to target.
          For [3,2,2,2] start with a divisor array and grow or shrink to target while sweeping indexes.

      123456
        this needs to yield segment keys of [3,1,1,1] & [2,2,1,1]
          For [3,1,1,1] start with a divisor array and shrink to target.
          For [2,2,1,1] start with a divisor array and grow or shrink to target while sweeping indexes.

      12345678
        this needs to yield segment keys of [2,2,2,2] & [3,2,2,1] & [ 3,3,1,1 ]
          For [2,2,2,2] accept the divisor array as is.
          For [3,2,2,1] start with the divisor array of [2,2,1,1] and grow or shrink to target.
          For [3,3,1,1] start with a max array of [3,3,3,3] and shrink to target.
    */

  const maxIPSegments = 4
  const maxSegmentLength = 3
  const midSegmentLength = 2
  const minSegmentLength = 1

  if ( typeof ipKey != String )
    ipKey = ipKey.toString()

  //Get IP Segment Divisor
  let divisor = 3

  if ( ipKey.length <= 4 )
    divisor = 1
  else if ( ipKey.length <= 8 )
    divisor = 2
  else if ( ipKey.length <= 12 )
    divisor = 3

  //TO DO: handle case where ipKey is empty value.

  const largestSegmentCount = Math.min( maxIPSegments,  Math.floor( ipKey.length / divisor ) )
  //const largestSegmentSize = divisor

  //const remainingSegmentSize = ipKey.length - ( largestSegmentCount * largestSegmentSize )
  
  let ipSegmentKeys = Array()

  if ( largestSegmentCount % maxIPSegments == 0 )
  {
    //Handle Standard Cases
    const standardSegmentKey = [ divisor, divisor, divisor, divisor ]
    ipSegmentKeys.push( standardSegmentKey )

    let ballanceSegmentKey = [ midSegmentLength, midSegmentLength, midSegmentLength, midSegmentLength ]
    
    //Build Grow-first IP Segement Key.
    let curIndex = 0
    let total = ballanceSegmentKey.length * midSegmentLength
    
    /*
      BALLANCED SEGMENT KEY
      This Segment Key algorithm starts with at a perfect mid-point in segment length distribution
      it proceeds to increment segment lengths up and down until a ballanced but non-standard 
      segment key is generated. 

      For Example:
        IP KEY: 12345678 (Length 8)
        Start: [2,2,2,2]
        End:   [3,1,2,2]
    */

    //@ignore-infinite
    while ( true )
    {
      if ( total < ipKey.length || total == ipKey.length )
      {
        ballanceSegmentKey[ curIndex ] = Math.min( 3, ballanceSegmentKey[ curIndex ] + 1 )

        total++
        curIndex++

        if ( curIndex >= ballanceSegmentKey.length )
          curIndex = 0
      }
      else if ( total > ipKey.length )
      {
        ballanceSegmentKey[ curIndex ] = Math.max( 1, ballanceSegmentKey[ curIndex ] - 1 )

        total--
        curIndex++

        if ( curIndex >= ballanceSegmentKey.length )
          curIndex = 0
      }

      if ( total == ipKey.length )
        break

    }

    if ( ballanceSegmentKey.length != 4 )
      debugger

    if ( !ArraysAreEqual(standardSegmentKey, ballanceSegmentKey ) )
      ipSegmentKeys.push( ballanceSegmentKey )

    /*
      SKEWED SEGMENT KEY
      This Segment Key algorithm starts with at a maximum segment length distribution
      it proceeds to decrement segments sequentially until the target is met. 

      For Example:
        IP KEY: 12345678 (Length 8)
        Start: [3,3,3,3]
        End:   [1,1,3,3]
    */

    let skewedSegmentKey = [ maxSegmentLength, maxSegmentLength, maxSegmentLength, maxSegmentLength ]
    
    //Build shrink-first IP Segement Key.
    curIndex = 0
    total = skewedSegmentKey.length * maxSegmentLength
    while ( curIndex < skewedSegmentKey.length )
    {
      if ( total > ipKey.length )
      {
        skewedSegmentKey[ curIndex ] = Math.max( 1, skewedSegmentKey[ curIndex ] - 1 )

        total--

        if ( skewedSegmentKey[ curIndex ] == 1 )
          curIndex++
      }
      else if ( total == ipKey.length )
        break
    }

    if ( skewedSegmentKey.length != 4 )
      debugger

    if ( !ArraysAreEqual( standardSegmentKey, skewedSegmentKey ) &&
    !ArraysAreEqual( ballanceSegmentKey, skewedSegmentKey ) )
      ipSegmentKeys.push( skewedSegmentKey )

  }
  else
  {
    
    /*
      STEP-DOWN SEGMENT KEY
      This Segment Key algorithm starts with a divisor segment length distribution
      it proceeds to decrement segments sequentially until the target is met. 

      For Example:
        IP KEY: 123456789 (Length 9)
        Start: [3,3,3,3]
        End:   [1,2,3,3]
    */

    let stepDownSegmentKey = [divisor,divisor,divisor,divisor]
  
    //Build Max-first IP Segement Key.
    let curIndex = 0
    let total = stepDownSegmentKey.length * divisor
    while ( curIndex < stepDownSegmentKey.length )
    {
      if ( total > ipKey.length )
      {
        stepDownSegmentKey[ curIndex ] = Math.max( 1, stepDownSegmentKey[ curIndex ] - 1 )

        total--

        if ( stepDownSegmentKey[ curIndex ] == 1 )
          curIndex++
      }
      else if ( total == ipKey.length )
        break
    }

    if ( stepDownSegmentKey.length != 4 )
      debugger

    ipSegmentKeys.push( stepDownSegmentKey )
    
    /*
      STEP & SWEEP SEGMENT KEY
      This Segment Key algorithm starts with a divisor segment length distribution
      it proceeds to step up or down while sweeping the segments sequentially until 
      the target is met. 

      For Example:
        IP KEY: 123456789 (Length 9)
        Start: [3,3,3,3]
        End:   [2,2,2,3]
    */

    let stepAndSweepSegmentKey = [ divisor, divisor, divisor, divisor ]

    //Build Min-first IP Segment Key.
    curIndex = 0
    total = stepAndSweepSegmentKey.length * divisor
    while ( total != ipKey.length )
    {
      if ( total > ipKey.length )
      {
        stepAndSweepSegmentKey[ curIndex ] = Math.max( 1, stepAndSweepSegmentKey[ curIndex ] - 1 )

        total--
        curIndex++

        if ( curIndex >= stepAndSweepSegmentKey.length )
          curIndex = 0

      }
      else if ( total < ipKey.length )
      {
        stepAndSweepSegmentKey[ curIndex ] = Math.min( 3, stepAndSweepSegmentKey[ curIndex ] + 1 )

        total++
        curIndex++

        if ( curIndex >= stepAndSweepSegmentKey.length )
          curIndex = 0
      }
    }


    if ( stepAndSweepSegmentKey.length != 4 )
      debugger

    if ( !ArraysAreEqual( stepAndSweepSegmentKey, stepDownSegmentKey ) )
      ipSegmentKeys.push( stepAndSweepSegmentKey )
  }

  for ( let i = 0; i < ipSegmentKeys.length; i++ )
  {
    ipSegmentKeys[i] = ipSegmentKeys[i].sort( (a, b) => b - a )
  }

//TO DO: Optimize based on these notes.

    //If all values in a segment key are the same, all ordering tables will be the same.
    //[3,3,3,3]
    //[2,2,2,2]
    //[2,2,2,2]

//This is the exact logic carried out below
//It address all 24 possible segment variations.

    //[0,1,2,3] Start

    //[0,1,2,3] ->Swap 0 & 0
      //[0,1,3,2] ->Swap 2 & 3

      //[0,2,1,3] ->Swap 1 & 2
        //[0,2,3,1 ->Swap 2 & 3

      //[0,3,2,1] ->Swap 1 & 3
        //[0,3,1,2] ->Swap 2 & 3

    //[1,0,2,3] -> Swap 0 & 1
      //[1,0,3,2] -> Swap 2 & 3

      //[1,2,0,3] ->Swap 1 & 2
        //[1,2,3,0] ->Swap 2 & 3

      //[1,3,2,0] ->Swap 1 & 3
        //[1,3,0,2] ->Swap 2 & 3

    //[2,1,0,3] ->Swap 0 & 2
      //[2,1,3,0] -> Swap 2 & 3

      //[2,0,1,3] ->Swap 1 & 2
        //[2,0,3,1] ->Swap 2 & 3

      //[2,3,0,1] ->Swap 1 & 3
        //[2,3,1,0] ->Swap 2 & 3

    //[3,1,2,0] ->Swap 0 & 3
      //[3,1,0,2] -> Swap 2 & 3

      //[3,2,1,0] ->Swap 1 & 2
        //[3,2,0,1] ->Swap -> Swap 2 & 3

      //[3,0,2,1] ->Swap 1 & 3
        //[3,0,1,2] ->Swap -> Swap 2 & 3

  //Build Ordering Tables
  let orderingTables = Array()
  for ( let i = 0; i < ipSegmentKeys.length; i++ )
  {
    const masterSegmentKey = ipSegmentKeys[ i ]

    for ( let firstCopyIndex = 0; firstCopyIndex < masterSegmentKey.length; firstCopyIndex++ )
    {
      //Shift the 1st segment.

      let workingSegmentKey = masterSegmentKey.slice() //[0,1,2,3] //TEST KEY FOR PROPER ORDER CHECKING.

      if ( firstCopyIndex > 0 )
      {
        const currentWorkingSegmentKey = ArraySwapElements( workingSegmentKey, 0, firstCopyIndex )
        orderingTables.push( currentWorkingSegmentKey )

        //Flip Tail Seqments
        const workingSegmentKeyTailDigits = ArraySwapElements( currentWorkingSegmentKey, 2, 3)
        orderingTables.push( workingSegmentKeyTailDigits )

        for ( let secondCopyIndex = 2; secondCopyIndex < masterSegmentKey.length; secondCopyIndex++ )
        {
          const subWorkingSegmentKey = ArraySwapElements( currentWorkingSegmentKey, 1, secondCopyIndex )
          orderingTables.push( subWorkingSegmentKey )

          //Flip Tail Sub Seqments
          const subWorkingSegmentKeyTailSegments = ArraySwapElements( subWorkingSegmentKey, 2, 3 )
          orderingTables.push( subWorkingSegmentKeyTailSegments )
        }

      }
      else
      {
        orderingTables.push( workingSegmentKey.slice() )

        //Flip Tail Seqments
        const workingSegmentKeyTailDigits = ArraySwapElements( workingSegmentKey, 2, 3)
        orderingTables.push( workingSegmentKeyTailDigits )

        for ( let secondCopyIndex = 2; secondCopyIndex < masterSegmentKey.length; secondCopyIndex++ )
        {
          const subWorkingSegmentKey = ArraySwapElements( workingSegmentKey, 1, secondCopyIndex )
          orderingTables.push( subWorkingSegmentKey )

          //Flip Tail Sub Seqments
          const subWorkingSegmentKeyTailSegment = ArraySwapElements( subWorkingSegmentKey, 2, 3)
          orderingTables.push( subWorkingSegmentKeyTailSegment )
        }

      }
    }
  }

//Clean up ordering tables.

  /*
  Test cases:
  -What happens when the ip key is length 5?
  -What happens when the ip key is less than 4 and can't generate a valid IP?
  -What happens if the divisable segments is clean, but less than 4?
  */

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