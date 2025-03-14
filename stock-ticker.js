import { KillDuplicateScriptsOnHost } from "utility.js"

const STOCK_SYMBOLS_DATA_FILENAME = "stock_symbols.txt"

const STOCK_UPDATE_INTERVAL     = 5000
const STOCK_GRAPH_MAX_HEIGHT    = 54
const STOCK_GRAPH_MAX_WIDTH     = 200

//This determines the scale of the graph using the given percentage of the starting stock price to set a maximum graph value above ane below the starting value line. 
const STOCK_GRAPH_VALUE_RANGE_PERCENTILE = 0.1

const STOCK_GRAPH_EMPTY_SYMBOL = " "
const STOCK_GRAPH_GAIN_SYMBOL = "$"
const STOCK_GRAPH_LOSS_SYMBOL = "!"
const STOCK_GRAPH_LINE_SYMBOL = "~"

/** @param {NS} ns */
export async function main(ns) 
{

  debugger

  //Only allow one gang manager to run at a time.
  KillDuplicateScriptsOnHost( ns, ns.getRunningScript() )

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
  let baselineGraphRow = Array()
  for ( let rowIndex = 0; rowIndex < STOCK_GRAPH_MAX_WIDTH; rowIndex++ )
  {
    emptyGraphRow.push( STOCK_GRAPH_EMPTY_SYMBOL )
    baselineGraphRow.push( STOCK_GRAPH_LINE_SYMBOL )
  }

  let graphHeight = Array()
  for ( let columnIndex = 0; columnIndex < STOCK_GRAPH_MAX_HEIGHT; columnIndex++ )
  {
    if ( Math.round( STOCK_GRAPH_MAX_HEIGHT / 2 ) == columnIndex )
    {
      const duplicateRowEntry = [ ...baselineGraphRow ]
      graphHeight.push( duplicateRowEntry )
    }
    else
    {
      const duplicateRowEntry = [ ...emptyGraphRow ]
      graphHeight.push( duplicateRowEntry )
    }
    
  }

  let finalStockValueRange = 0 
  let stockValuePerColumn = 0

  let firstPrice = -1
  let priceDelta = 0
  let currentPrice = 0
  while ( true )
  {
    if ( targetSymbol == "all" )
    {
      //Get average of all stock values.
      currentPrice = GetTotalMarketPrice( ns, stockSymbols )
      
      if ( firstPrice == -1 )
      {
        firstPrice = currentPrice
        finalStockValueRange = ( firstPrice * STOCK_GRAPH_VALUE_RANGE_PERCENTILE ) * 2
        stockValuePerColumn = finalStockValueRange / STOCK_GRAPH_MAX_HEIGHT
      }
        

    }
    else
    {
      currentPrice = ns.stock.getPrice( targetSymbol )

      if ( firstPrice == -1 )
      {
        firstPrice = currentPrice
        finalStockValueRange = ( firstPrice * STOCK_GRAPH_VALUE_RANGE_PERCENTILE ) * 2
        stockValuePerColumn = finalStockValueRange / STOCK_GRAPH_MAX_HEIGHT
      }
        
    }

    priceDelta = currentPrice - firstPrice

    const columnHeight  = Math.round( priceDelta / stockValuePerColumn )
    const startFillHeight = priceDelta > 0 ? STOCK_GRAPH_MAX_HEIGHT - (( STOCK_GRAPH_MAX_HEIGHT / 2 ) + columnHeight) : ( STOCK_GRAPH_MAX_HEIGHT / 2 ) - columnHeight

    for ( let columnIndex = 0; columnIndex < graphHeight.length; columnIndex++ )
    {

      const graphRow = graphHeight[columnIndex]

      if ( startFillHeight <= columnIndex )
      {
        if ( priceDelta > 0 )
        {
          graphRow.pop()
          graphRow.unshift(STOCK_GRAPH_GAIN_SYMBOL)
        }
        else
        {
          graphRow.pop()
          graphRow.unshift(STOCK_GRAPH_LOSS_SYMBOL)
        }
        
      }
      else
      {

        if ( Math.round( STOCK_GRAPH_MAX_HEIGHT / 2 ) == columnIndex )
        {
          graphRow.pop()
          graphRow.unshift(STOCK_GRAPH_LINE_SYMBOL)
        }
        else
        {
          graphRow.pop()
          graphRow.unshift(STOCK_GRAPH_EMPTY_SYMBOL)
        }
      }
      
      const rowOutput = graphRow.join( "" )
      ns.tprint( rowOutput )
    } 

    ns.tprint( "Symbol: " + targetSymbol + "| Price: " + currentPrice + "| Delta: " + priceDelta )

    await ns.sleep( STOCK_UPDATE_INTERVAL )
  }

}

function GetTotalMarketPrice( ns, stockSymbols )
{
  let totalMarketValue = 0

  for ( let stockIndex = 0; stockIndex < stockSymbols.length; stockIndex++ )
  {
    const stockSymbol = stockSymbols[stockIndex]

    totalMarketValue += ns.stock.getPrice( stockSymbol )

  }

  return totalMarketValue /// stockSymbols.length

}