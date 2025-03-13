function ScanData( serverCount, rootCount, hackableCount, backdoorCount )
{
  this.serverCount    = serverCount
  this.rootCount      = rootCount
  this.hackableCount  = hackableCount
  this.backdoorCount  = backdoorCount
}

/** @param {NS} ns */
export async function main(ns) 
{

  const scanData = ScanNetLayer( ns, "home", "home", 0, "" )

  debugger

  const rootPercent     = Math.floor( ( scanData.rootCount / scanData.serverCount )     * 100 )
  const hackablePrecent = Math.floor( ( scanData.hackableCount / scanData.serverCount ) * 100 )
  const backdoorPercent = Math.floor( ( scanData.backdoorCount / scanData.serverCount ) * 100 )

  ns.tprint( "\n" )
  ns.tprint("===================================================================================")
  ns.tprint( "Net Scan Summary" )
  ns.tprint( "Root Access: " + scanData.rootCount + " of " + scanData.serverCount + " (" + rootPercent + "%)" )
  ns.tprint( "Hackable: " + scanData.hackableCount + " of " + scanData.serverCount + " (" + hackablePrecent + "%)" )
  ns.tprint( "Backdoors: " + scanData.backdoorCount + " of " + scanData.serverCount + " (" + backdoorPercent + "%)" )
  ns.tprint("===================================================================================")
}

function ScanNetLayer( ns, hostServer, parentServer, searchDepth, priorString )
{
  //This should be called with "home" as the starting server by the caller.
  const connections = ns.scan( hostServer )
  
  const myHackingLevel = ns.getHackingLevel()

  let scanData = new ScanData(
    0,
    0,
    0,
    0,
  )

  let passAlongString = priorString
  let lastPassAlongString = priorString
  let depthString = ""
  
  if( searchDepth == 0 )
  {
    depthString = "|"
    passAlongString += "|  "
    lastPassAlongString += "   "
  }
  else if( searchDepth == 1 )
  {
    depthString = "|  "
    passAlongString += "|  "
    lastPassAlongString += "   "
  }
  else if ( searchDepth > 1 )
  {
    depthString = priorString + "|--"
    passAlongString = priorString + "|  "
    lastPassAlongString = priorString + "   "
    //depthString = priorString + "   ".repeat( searchDepth - 1 )
  }

   
  
  for ( let i = 0; i < connections.length; i++ )
  {
    const currentConnection = connections[ i ]

    if ( currentConnection == parentServer )
      continue

    const serverInfo = ns.getServer( currentConnection )

    //serverInfo.organizationName
    //serverInfo.hasRootAccess
    //serverInfo.backdoorInstalled
    //serverInfo.ip
    const requiredHackingLevel = ns.getServerRequiredHackingLevel( currentConnection )

    const canHack = myHackingLevel >= requiredHackingLevel

    const serverPrint = depthString + currentConnection
    
    scanData.serverCount++

    if ( serverInfo.hasAdminRights )
      scanData.rootCount++

    if ( canHack )
      scanData.hackableCount++

    if ( serverInfo.backdoorInstalled )
      scanData.backdoorCount++

    ns.tprint( serverPrint )
    
    if ( ns.scan( currentConnection ).length > 1 )
    {

      const hostScan = ns.scan( hostServer )

      //Server Listing: Is Last For Parent, Has Children
      if ( hostScan[ hostScan.length - 1 ] == currentConnection )
      {
        const serverDetail = lastPassAlongString +
        "|  Org: " + serverInfo.organizationName +
        " @" + serverInfo.ip +
        " | Root: " + serverInfo.hasAdminRights +
        " | Hackable: " + canHack +
        " | Backdoor: " + serverInfo.backdoorInstalled

        ns.tprint( serverDetail )
      }
      //Server Listing: Not Last For Parent, Has Children
      else
      {
        const serverDetail = passAlongString +
        "|  Org: " + serverInfo.organizationName +
        " @" + serverInfo.ip +
        " | Root: " + serverInfo.hasAdminRights +
        " | Hackable: " + canHack +
        " | Backdoor: " + serverInfo.backdoorInstalled

        ns.tprint( serverDetail )
      }
            
    }
    else
    {

      //Server Listing: No Children, Last For Parent
      if ( i == connections.length - 1 )
      {
        const serverDetail = lastPassAlongString +
        "  Org: " + serverInfo.organizationName +
        " @" + serverInfo.ip +
        " | Root: " + serverInfo.hasAdminRights +
        " | Hackable: " + canHack +
        " | Backdoor: " + serverInfo.backdoorInstalled

        ns.tprint( serverDetail )
      }

      //Server Listing: No Children, Not Last
      else
      {
        const serverDetail = passAlongString +
        "  Org: " + serverInfo.organizationName +
        " @" + serverInfo.ip +
        " | Root: " + serverInfo.hasAdminRights +
        " | Hackable: " + canHack +
        " | Backdoor: " + serverInfo.backdoorInstalled

        ns.tprint( serverDetail )
      }      
    }

    //Scan sub-networks.
    if ( i == connections.length - 1 )
    {
      const subNetScanData = ScanNetLayer( ns, currentConnection, hostServer, searchDepth + 1, lastPassAlongString )  
      scanData.serverCount    += subNetScanData.serverCount
      scanData.rootCount      += subNetScanData.rootCount
      scanData.hackableCount  += subNetScanData.hackableCount
      scanData.backdoorCount  += subNetScanData.backdoorCount
    } 
    else
    {
      const subNetScanData = ScanNetLayer( ns, currentConnection, hostServer, searchDepth + 1, passAlongString )  
      scanData.serverCount    += subNetScanData.serverCount
      scanData.rootCount      += subNetScanData.rootCount
      scanData.hackableCount  += subNetScanData.hackableCount
      scanData.backdoorCount  += subNetScanData.backdoorCount
    }
    
  }

  return scanData

}
