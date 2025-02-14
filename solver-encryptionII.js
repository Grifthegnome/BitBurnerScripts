/** @param {NS} ns */
export async function main(ns) 
{
  const plainText = ns.args[0]
  const keyword   = ns.args[1]

  SolveEncryptionII( plainText, keyword )
}
  //Solve for EncryptionII 
export function SolveEncryptionII(ns, plainText, keyword )
{

  let keywordLoop = ""

  if ( plainText.length < keyword.length )
  {

    for ( let i = 0; i < plainText.length; i++ )
    {
      keywordLoop += keyword[i]
    }

  }
  else
  {
    const timesDivisable  = Math.floor( plainText.length / keyword.length )
    const remainder       = plainText.length % keyword.length

    keywordLoop = keyword.repeat( timesDivisable )

    for ( let i = 0; i < remainder; i++ )
    {
      keywordLoop += keyword[i]
    }

    if ( keywordLoop.length != plainText.length )
      debugger

  }

  const plainTextIndices    = ConvertToIndices( plainText )
  const keywordLoopIndices  = ConvertToIndices( keywordLoop )

  if ( keywordLoopIndices.length != plainTextIndices.length )
      debugger

  const alphabetRow = [ "A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"]

  let cyperString = ""

  for ( let index = 0; index < keywordLoopIndices.length; index++ )
  {
    let cypherIndex = keywordLoopIndices[index] + plainTextIndices[index]

    if ( cypherIndex >= alphabetRow.length )
      cypherIndex -= alphabetRow.length

    cyperString += alphabetRow[ cypherIndex ]
  }

  ns.tprint( cyperString )

  return cyperString

}

function ConvertToIndices( string )
{
  const alphabetRow = [ "A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"]

  let indices = Array()

  for ( let i = 0; i < string.length; i++ )
  {
    const index = alphabetRow.findIndex( element => element == string[i] )
    indices.push( index )
  }

  return indices

}