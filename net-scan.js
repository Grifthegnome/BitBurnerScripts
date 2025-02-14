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

    const serverPrint = depthString + currentConnection
    ns.tprint( serverPrint )
    
    //Scan sub-networks.
    if ( i == connections.length - 1 )
    {
      ScanNetLayer( ns, currentConnection, hostServer, searchDepth + 1, lastPassAlongString )  
    }
    else
    {
      ScanNetLayer( ns, currentConnection, hostServer, searchDepth + 1, passAlongString )  
    }
    
  }
}
