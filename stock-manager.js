import { KillDuplicateScriptsOnHost } from "utility.js"

function StockPriceRangeData( high, low, positivePriceDelta, negativePriceDelta, priceTrendPercentile, trendPositivePercentile, trendNegativePercentile, secondOrderTrendPercentile )
{
  this.high = high
  this.low  = low
  this.positivePriceDelta   = positivePriceDelta
  this.negativePriceDelta   = negativePriceDelta
  this.priceTrendPercentile     = priceTrendPercentile  //The percentage chance the stock will trend up or down.
  this.trendPositivePercentile  = trendPositivePercentile
  this.trendNegativePercentile  = trendNegativePercentile
  this.secondOrderTrendPercentile = secondOrderTrendPercentile //The percentage chance the stock's price trend will trend upwards or downwards
}

const STOCK_SYMBOLS_DATA_FILENAME = "stock_symbols.txt"
const STOCK_PRICE_RANGE_DATA_FILENAME = "stock_price_ranges.txt"

const STOCK_TRANSACTION_FEE = 100000

const STOCK_UPDATE_INTERVAL = 5000

/** @param {NS} ns */
export async function main(ns) 
{

  //Only allow one gang manager to run at a time.
  KillDuplicateScriptsOnHost( ns, ns.getRunningScript() )

  if( !ns.stock.hasWSEAccount() )
  {
    ns.tprint( "You don't have a World Stock Exchange account." )
    ns.tprint( "Terminating script." )
    return
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

  /*
  Note: We need to keep in mind that every stock transaction costs 100K just to execute.

  This means that any stock sale needs to make at least 200k to turn any profit.

  It also means that buying stock in bulk is the most cost effective way to reduce transaction costs.

  We may want to focus on buying stocks and deversifying a portfolio.

  */

  let marketPriceRangeData = {}
  if ( ns.fileExists( STOCK_PRICE_RANGE_DATA_FILENAME, "home" ) )
  {
    const jsonString = ns.read( STOCK_PRICE_RANGE_DATA_FILENAME )
    marketPriceRangeData = JSON.parse( jsonString )
  }

  let lastPriceHash = {}

  while ( true )
  {

    let updateDataFile = false

    for ( let stockIndex = 0; stockIndex < stockSymbols.length; stockIndex++ )
    {
      const stockName = stockSymbols[ stockIndex ]
      const price = ns.stock.getPrice( stockName )

      if ( !(stockName in lastPriceHash) )
        lastPriceHash[ stockName ] = price

      if ( stockName in marketPriceRangeData )
      {
        const lastStockPrice = lastPriceHash[ stockName ]
        const priceDelta = price - lastStockPrice
        const priceRangeData = marketPriceRangeData[ stockName ]
        lastPriceHash[ stockName ] = price

        if ( price > priceRangeData.high )
        {
          marketPriceRangeData[ stockName ].high = price
          updateDataFile = true
        }

        if ( price < priceRangeData.low )
        {
          marketPriceRangeData[ stockName ].low = price
          updateDataFile = true
        }

        if ( priceDelta > 0 )
        {
          marketPriceRangeData[ stockName ].positivePriceDelta += priceDelta
          updateDataFile = true
        }
        else if ( priceDelta < 0 )
        {
          marketPriceRangeData[ stockName ].negativePriceDelta += -priceDelta
          updateDataFile = true
        }

        const positivePriceDelta = marketPriceRangeData[ stockName ].positivePriceDelta
        const negativePriceDelta = marketPriceRangeData[ stockName ].negativePriceDelta
        const deltaTotal = positivePriceDelta + negativePriceDelta

        let priceTrendPercentile = 0
        if ( positivePriceDelta > negativePriceDelta )
        {
          
          priceTrendPercentile = positivePriceDelta / deltaTotal

          const lastPriceTrendPercentile = marketPriceRangeData[ stockName ].priceTrendPercentile
          const priceTrendPercentileDelta = priceTrendPercentile - lastPriceTrendPercentile

          if ( priceTrendPercentileDelta > 0 )
            marketPriceRangeData[ stockName ].trendPositivePercentile += priceTrendPercentileDelta
          else if ( priceTrendPercentileDelta < 0 )
            marketPriceRangeData[ stockName ].trendNegativePercentile += -priceTrendPercentileDelta

          marketPriceRangeData[ stockName ].priceTrendPercentile = priceTrendPercentile
          updateDataFile = true
          
        }
        else if ( negativePriceDelta > positivePriceDelta )
        {
          priceTrendPercentile = -( negativePriceDelta / deltaTotal )

          const lastPriceTrendPercentile = marketPriceRangeData[ stockName ].priceTrendPercentile
          const priceTrendPercentileDelta = priceTrendPercentile - lastPriceTrendPercentile

          if ( priceTrendPercentileDelta > 0 )
            marketPriceRangeData[ stockName ].trendPositivePercentile += priceTrendPercentileDelta
          else if ( priceTrendPercentileDelta < 0 )
            marketPriceRangeData[ stockName ].trendNegativePercentile += -priceTrendPercentileDelta

          marketPriceRangeData[ stockName ].priceTrendPercentile = priceTrendPercentile
          updateDataFile = true
        }

        const trendPositivePercentile   = marketPriceRangeData[ stockName ].trendPositivePercentile
        const trendNegativePercentile   = marketPriceRangeData[ stockName ].trendNegativePercentile
        const trendPercentileDeltaTotal = trendPositivePercentile + trendNegativePercentile

        let secondOrderTrendPercentile = 0
        if ( trendPositivePercentile > trendNegativePercentile )
        {
          secondOrderTrendPercentile = trendPositivePercentile / trendPercentileDeltaTotal
          marketPriceRangeData[ stockName ].secondOrderTrendPercentile = secondOrderTrendPercentile
          updateDataFile = true
        }
        else if ( trendNegativePercentile > trendPositivePercentile )
        {
          secondOrderTrendPercentile = -( trendNegativePercentile / trendPercentileDeltaTotal )
          marketPriceRangeData[ stockName ].secondOrderTrendPercentile = secondOrderTrendPercentile
          updateDataFile = true
        }

      }
      else
      {
        const stockPriceRangeDataEntry = new StockPriceRangeData( price, price, 0, 0, 0, 0, 0, 0 )
        marketPriceRangeData[ stockName ] = stockPriceRangeDataEntry
        updateDataFile = true
      }

    }

    if ( updateDataFile )
    {
      const jsonString = JSON.stringify( marketPriceRangeData )
      await ns.write( STOCK_PRICE_RANGE_DATA_FILENAME, jsonString, "w" )
    }

    await ns.sleep( STOCK_UPDATE_INTERVAL )

  }

}