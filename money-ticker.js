import { KillDuplicateScriptsOnHost } from "utility.js"
import { AddCommasToNumber } from "utility.js"

function AccountRowData( startFillHeight, rowSymbol )
{
  this.startFillHeight = startFillHeight
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
    let rowData = new AccountRowData( MONEY_GRAPH_MAX_HEIGHT, MONEY_GRAPH_EMPTY_SYMBOL )
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
      graphRows = ScaleExistingGraphToNewScale( graphRows, 10 )
    }
    else if ( currentAccountBalance <= accountValueRange / 10 )
    {
      accountValueRange /= 10
      accountValuePerColumn  = accountValueRange / MONEY_GRAPH_MAX_HEIGHT
      graphRows = ScaleExistingGraphToNewScale( graphRows, -10 )
    }

    accountDelta = currentAccountBalance - lastAccountBalance

    const columnHeight    = Math.round( currentAccountBalance / accountValuePerColumn )
    const startFillHeight = MONEY_GRAPH_MAX_HEIGHT - columnHeight

    //Shift the columns with new data.
    if ( accountDelta > 0 )
    {
      let newRowData = new AccountRowData( startFillHeight, MONEY_GRAPH_GAIN_SYMBOL )
      graphRows.pop()
      graphRows.unshift(newRowData)
    }
    else
    {
      let newRowData = new AccountRowData( startFillHeight, MONEY_GRAPH_LOSS_SYMBOL )
      graphRows.pop()
      graphRows.unshift(newRowData)
    }  

    for ( let columnIndex = 0; columnIndex < MONEY_GRAPH_MAX_HEIGHT; columnIndex++ )
    {
      let columnOutput = ""

      for ( let rowIndex = 0; rowIndex < graphRows.length; rowIndex++ )
      {
        const graphRow = graphRows[rowIndex]
        const startFillHeight = graphRow.startFillHeight

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

    /*
    for ( let rowIndex = 0; rowIndex < graphRows.length; rowIndex++ )
    {
      const graphRow = graphRows[rowIndex]
      const startFillHeight = graphRow.startFillHeight

      for ( let columnIndex = 0; columnIndex < MONEY_GRAPH_MAX_HEIGHT; columnIndex++ )
      {

      }

      for ( let rowIndex = 0; rowIndex < MONEY_GRAPH_MAX_WIDTH; rowIndex++ )
      {
        let rowOutput = ""

        if ( startFillHeight <= rowIndex )
        {
          if ( accountDelta > 0 )
          {
            graphRow.pop()
            graphRow.unshift(MONEY_GRAPH_GAIN_SYMBOL)
            graphRows[columnIndex] = graphRow
          }
          else
          {
            graphRow.pop()
            graphRow.unshift(MONEY_GRAPH_LOSS_SYMBOL)
            graphRows[columnIndex] = graphRow
          }
          
        }
        else
        {
          graphRow.pop()
          graphRow.unshift(MONEY_GRAPH_EMPTY_SYMBOL)
          graphRows[columnIndex] = graphRow
        }
        
        //const rowOutput = graphColumn.join( "" )
        ns.tprint( rowOutput )
      }

      
    } 
    */

    ns.tprint( "Account Value: " + AddCommasToNumber( currentAccountBalance ) + " | Delta: " + AddCommasToNumber( accountDelta ) + " | Graph Max Value: " + AddCommasToNumber( accountValueRange ) )

    lastAccountBalance = currentAccountBalance

    await ns.sleep( MONEY_UPDATE_INTERVAL )
  }

}

function ScaleExistingGraphToNewScale( graphRows, scalar )
{
  debugger

  let shouldScaleDown   = false
  let nonNegativeScalar = scalar

  //To Do: Ensure we don't divide by zero.

  if ( scalar < 0 )
  {
    shouldScaleDown = true
    nonNegativeScalar = -scalar
  }

  for ( let rowIndex = 0; rowIndex < graphRows.length; rowIndex++ )
  {
    if ( shouldScaleDown )
      graphRows[rowIndex].startFillHeight = Math.max( Math.round( graphRows[rowIndex].startFillHeight / nonNegativeScalar ), 1 )
    else
      graphRows[rowIndex].startFillHeight = Math.min( Math.round( graphRows[rowIndex].startFillHeight * nonNegativeScalar ), MONEY_GRAPH_MAX_HEIGHT )
  }

  return graphRows

}