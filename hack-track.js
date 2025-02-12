//This script tracks a server and gives us an interval on how often it is vulnrable to hacking.

import { GetReadableDateDelta } from "utility.js"

/** @param {NS} ns */
export async function main(ns) {
  const targetServer = ns.args[0]

  let targetVulnrable = false
  let systemDate = new Date()

  let lastHackTime = systemDate.getTime()
  let avgHackTime = -1

  const myHackingLevel = ns.getHackingLevel()

  const maxMoney    = ns.getServerMaxMoney( targetServer )
  const minSec      = ns.getServerMinSecurityLevel( targetServer )
  const reqHackLvl  = ns.getServerRequiredHackingLevel( targetServer )

  let lastMoney = ns.getServerMoneyAvailable( targetServer )
  let lastSec   = ns.getServerSecurityLevel( targetServer )

  while ( true )
  {

    let curMoney  = ns.getServerMoneyAvailable( targetServer )
    let curSec    = ns.getServerSecurityLevel( targetServer )

    if ( reqHackLvl > myHackingLevel )
    {
      ns.tprint( "Server " + targetServer + " is too high level to hack. " )
    }
    else if ( curMoney == maxMoney && curSec == minSec )
    {

      if ( !targetVulnrable )
      {
        //debugger
        ns.tprint( "\n" )
        ns.tprint( "Server " + targetServer + " is vulnrable to hack." )
        
        systemDate = new Date()
        let curTime = systemDate.getTime()

        let deltaDate = Math.abs( curTime - lastHackTime )

        let readableDeltaDate = GetReadableDateDelta( deltaDate )

        ns.tprint( "Time Since Last Hack: " + readableDeltaDate )

        if ( avgHackTime == -1 )
        {
          avgHackTime = deltaDate
          let readableAvgDeltaDate = GetReadableDateDelta( avgHackTime )
          ns.tprint( "Average Time Since Last Hack: " + readableAvgDeltaDate )
        }
        else
        {
          avgHackTime = ( avgHackTime + deltaDate ) / 2
          let readableAvgDeltaDate = GetReadableDateDelta( avgHackTime )
          ns.tprint( "Average Time Since Last Hack: " + readableAvgDeltaDate )
        }

        lastHackTime = curTime

        targetVulnrable = true
      }      
    }
    else
    {
      targetVulnrable = false
    }

    if ( lastMoney != curMoney || lastSec != curSec )
    {
      ns.tprint( "\n" )
      ns.tprint( "server: " + targetServer )
      ns.tprint( "money: " + curMoney + " of " + maxMoney + " Maximum" )
      ns.tprint( "sec level: " + curSec+ " of " + minSec + " Minimum")
      ns.tprint( "hacking level: " + reqHackLvl )
      ns.tprint( "hacking time: " + GetReadableDateDelta( ns.getHackTime( targetServer ) ) )
      //ns.tprint( "hack percentage: " + ns.hackAnalyze( targetServer ) )
    }

    lastMoney = curMoney
    lastSec = curSec

    await ns.sleep( 1000 )
  }
}