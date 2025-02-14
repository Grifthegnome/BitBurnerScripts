/** @param {NS} ns */
export async function main(ns) 
{

  ScanNetLayer( ns, "home", "home", 0, "" )

}

function ScanNetLayer( ns, hostServer, parentServer, searchDepth, priorString )
{
  //This should be called with "home" as the starting server by the caller.
  const connections = ns.scan( hostServer )
  
  let passAlongString = priorString
  let lastPassAlongString = priorString
  let depthString = ""
  
  if( searchDepth == 1 )
  {
    depthString = "|---"
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

    const serverPrint = depthString + currentConnection
    
    ns.tprint( serverPrint )
    
    if ( ns.scan( currentConnection ).length > 1 )
    {

      const hostScan = ns.scan( hostServer )

      //Server Listing: Is Last For Parent, Has Children
      if ( hostScan[ hostScan.length - 1 ] == currentConnection )
      {
        const serverDetail = lastPassAlongString +
        "|    Org: " + serverInfo.organizationName +
        " @" + serverInfo.ip +
        " | Root: " + serverInfo.hasAdminRights +
        " | Backdoor: " + serverInfo.backdoorInstalled

        ns.tprint( serverDetail )
      }
      //Server Listing: Not Last For Parent, Has Children
      else
      {
        const serverDetail = passAlongString +
        "|    Org: " + serverInfo.organizationName +
        " @" + serverInfo.ip +
        " | Root: " + serverInfo.hasAdminRights +
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
        "     Org: " + serverInfo.organizationName +
        " @" + serverInfo.ip +
        " | Root: " + serverInfo.hasAdminRights +
        " | Backdoor: " + serverInfo.backdoorInstalled

        ns.tprint( serverDetail )
      }

      //Server Listing: No Children, Not Last
      else
      {
        const serverDetail = passAlongString +
        "     Org: " + serverInfo.organizationName +
        " @" + serverInfo.ip +
        " | Root: " + serverInfo.hasAdminRights +
        " | Backdoor: " + serverInfo.backdoorInstalled

        ns.tprint( serverDetail )
      }      
    }

    //Scan sub-networks.
    if ( i == connections.length - 1 )
      ScanNetLayer( ns, currentConnection, hostServer, searchDepth + 1, lastPassAlongString )  
    else
      ScanNetLayer( ns, currentConnection, hostServer, searchDepth + 1, passAlongString )  
    
  }
}
