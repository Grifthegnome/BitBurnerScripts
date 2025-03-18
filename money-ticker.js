import { KillDuplicateScriptsOnHost } from "utility.js"
import { AddCommasToNumber } from "utility.js"

function AccountRowData( rowValue, rowSymbol )
{
  this.rowValue = rowValue
  this.rowSymbol = rowSymbol
}

const MONEY_UPDATE_INTERVAL     = 1000
const MONEY_GRAPH_MAX_HEIGHT    = 53
const MONEY_GRAPH_MAX_WIDTH     = 200

const MONEY_GRAPH_EMPTY_SYMBOL = " "
const MONEY_GRAPH_GAIN_SYMBOL = "$"
const MONEY_GRAPH_LOSS_SYMBOL = "!"

/** @param {NS} ns */
export async function main(ns) 
{

  debugger

  //Only allow one gang manager to run at a time.
  KillDuplicateScriptsOnHost( ns, ns.getRunningScript() )

  let graphRows = Array()
  for ( let rowIndex = 0; rowIndex < MONEY_GRAPH_MAX_WIDTH; rowIndex++ )
  {
    let rowData = new AccountRowData( 0, MONEY_GRAPH_EMPTY_SYMBOL )
    graphRows.push( rowData )
  }

  let accountValueRange = 100000000
  let accountValuePerColumn  = accountValueRange / MONEY_GRAPH_MAX_HEIGHT

  let lastAccountBalance = ns.getServerMoneyAvailable( "home" )
  let accountDelta = 0
  let currentAccountBalance = 0

  while ( true )
  {    
    currentAccountBalance = ns.getServerMoneyAvailable( "home" )

    if ( currentAccountBalance >= accountValueRange )
    {
      accountValueRange *= 10
      accountValuePerColumn  = accountValueRange / MONEY_GRAPH_MAX_HEIGHT
    }
    else if ( currentAccountBalance <= accountValueRange / 10 )
    {
      accountValueRange /= 10
      accountValuePerColumn  = accountValueRange / MONEY_GRAPH_MAX_HEIGHT
    }

    accountDelta = currentAccountBalance - lastAccountBalance

    //Shift the columns with new data.
    if ( accountDelta > 0 )
    {
      let newRowData = new AccountRowData( currentAccountBalance, MONEY_GRAPH_GAIN_SYMBOL )
      graphRows.pop()
      graphRows.unshift(newRowData)
    }
    else
    {
      let newRowData = new AccountRowData( currentAccountBalance, MONEY_GRAPH_LOSS_SYMBOL )
      graphRows.pop()
      graphRows.unshift(newRowData)
    }  

    for ( let columnIndex = 0; columnIndex < MONEY_GRAPH_MAX_HEIGHT; columnIndex++ )
    {
      let columnOutput = ""

      for ( let rowIndex = 0; rowIndex < graphRows.length; rowIndex++ )
      {
        const graphRow = graphRows[rowIndex]
        const rowValue = graphRow.rowValue

        const columnHeight    = Math.round( rowValue / accountValuePerColumn )
        const startFillHeight = MONEY_GRAPH_MAX_HEIGHT - columnHeight

        if ( startFillHeight <= columnIndex )
        {
          columnOutput += graphRow.rowSymbol
        }
        else
        {
          columnOutput += MONEY_GRAPH_EMPTY_SYMBOL
        }

      }

      ns.tprint( columnOutput )
    }

    ns.tprint( "Account Value: " + AddCommasToNumber( currentAccountBalance ) + " | Delta: " + AddCommasToNumber( accountDelta ) + " | Graph Max Value: " + AddCommasToNumber( accountValueRange ) )

    lastAccountBalance = currentAccountBalance

    await ns.sleep( MONEY_UPDATE_INTERVAL )
  }

}