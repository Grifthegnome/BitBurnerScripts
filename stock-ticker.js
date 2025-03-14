
const STOCK_SYMBOLS_DATA_FILENAME = "stock_symbols.txt"

const STOCK_UPDATE_INTERVAL = 7000
const STOCK_MIN_VAL = 0
const STOCK_MAX_VAL = 500000
const STOCK_GRAPH_MAX_HEIGHT = 20
const STOCK_GRAPH_MAX_WIDTH = 200

const STOCK_GRAPH_EMPTY_SYMBOL = " "
const STOCK_GRAPH_VALUE_SYMBOL = "$"

/** @param {NS} ns */
export async function main(ns) 
{

  debugger

  if( !ns.stock.hasWSEAccount() )
  {
    ns.tprint( "You don't have a World Stock Exchange account." )
    ns.tprint( "Terminating script." )
    return
  }

  if ( !ns.stock.hasTIXAPIAccess() )
  {
    ns.tprint( "You don't have TIX API Access to run stock market functions." )
    ns.tprint( "Terminating script." )
    return
  }

  let targetSymbol = "all"
  if ( ns.args.length )
  {
    targetSymbol = ns.args[0]
  }

  //Retrieve or build list of valid stock symbols.
  let stockSymbols = Array()
  if ( ns.fileExists( STOCK_SYMBOLS_DATA_FILENAME, "home" ) )
  {
    const jsonString = ns.read(STOCK_SYMBOLS_DATA_FILENAME)
    stockSymbols = JSON.parse( jsonString )
  }
  else
  {
    if ( ns.stock.hasTIXAPIAccess() )
    {
      stockSymbols = ns.stock.getSymbols()
      const jsonString = JSON.stringify( stockSymbols )
      await ns.write( STOCK_SYMBOLS_DATA_FILENAME, jsonString, "w" )
    }
  }

  if ( stockSymbols.length <= 0 )
  {
    ns.tprint( "We don't have a valid list of stock symbols, ensure " + STOCK_SYMBOLS_DATA_FILENAME + " is populated or purchase TIX API." )
    ns.tprint( "Terminating script." )
    return
  }

  if ( targetSymbol != "all" )
  {
    if ( !stockSymbols.includes( targetSymbol ) )
    {
      ns.tprint( targetSymbol + " is not a valid stock symbol, please input a valid symbol or use 'all' to sample entire market." )
      ns.tprint( "Terminating script." )
      return
    }
  }

  let emptyGraphRow = Array()
  for ( let rowIndex = 0; rowIndex < STOCK_GRAPH_MAX_WIDTH; rowIndex++ )
  {
    const emptyRowEntry = STOCK_GRAPH_EMPTY_SYMBOL
    emptyGraphRow.push( emptyRowEntry )
  }

  let graphHeight = Array()
  for ( let columnIndex = 0; columnIndex < STOCK_GRAPH_MAX_HEIGHT; columnIndex++ )
  {
    const duplicateRowEntry = [ ...emptyGraphRow ]
    graphHeight.push( duplicateRowEntry )
  }

  const stockValuePerColumn = STOCK_MAX_VAL / STOCK_GRAPH_MAX_HEIGHT

  while ( true )
  {
    let currentPosition = 0
    if ( targetSymbol == "all" )
    {
      //To Do: Get average of all stock values.
    }
    else
    {
      currentPosition = ns.stock.getPosition( targetSymbol )
    }

    const columnHeight  = Math.round( currentPosition / stockValuePerColumn )
    const maxFillHeight = STOCK_GRAPH_MAX_HEIGHT - columnHeight

    for ( let columnIndex = 0; columnIndex < graphHeight.length; columnIndex++ )
    {

      const graphRow = graphHeight[columnIndex]

      if ( maxFillHeight >= columnIndex )
      {
        graphRow.pop()
        graphRow.unshift(STOCK_GRAPH_VALUE_SYMBOL)
      }
      else
      {
        graphRow.pop()
        graphRow.unshift(STOCK_GRAPH_EMPTY_SYMBOL)
      }
      

      /*
      for ( let rowIndex = 0; rowIndex < graphHeight[columnIndex].length; rowIndex++ )
      {

      }
      */
    }
    

    await ns.sleep( STOCK_UPDATE_INTERVAL )
  }

}