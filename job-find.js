import { GetCompanyList } from "utility.js"

function PotentialJobData( companyName, jobInfo )
{
  this.companyName = companyName
  this.jobInfo     = jobInfo
}

/** @param {NS} ns */
export async function main(ns) 
{

  if ( !(ns.singularity) )
  {
    ns.tprint( "You don't have access to the singularity API." )
    ns.tprint( "Terminating script." )
    return
  }

  const companyList = GetCompanyList()
  const player = ns.getPlayer()

  let potentialJobs = Array()

  for ( let companyIndex = 0; companyIndex < companyList.length; companyIndex++ )
  {
    const companyName = companyList[companyIndex]
    const companyRep  = ns.singularity.getCompanyRep( companyName )
    const jobNames = ns.singularity.getCompanyPositions( companyName )

    for ( let jobIndex = 0; jobIndex < jobNames.length; jobIndex++ )
    {
      const jobName = jobNames[jobIndex]
      const jobInfo = ns.singularity.getCompanyPositionInfo( companyName, jobName )

      if ( jobInfo.requiredReputation > companyRep )
        continue

      const requiredSkills = jobInfo.requiredSkills
      const skillKeys = Object.keys( requiredSkills )
      let playerIsQualified = true
      for ( let skillIndex = 0; skillIndex < skillKeys.length; skillIndex++ )
      {
        const skillName = skillKeys[skillIndex]
        const requiredSkillLevel = requiredSkills[skillName]

        if ( requiredSkillLevel < 1 )
          continue

        const playerSkillLevel = player.skills[ skillName ]
        if ( playerSkillLevel < requiredSkillLevel )
        {
          playerIsQualified = false
          break
        }

      }

      if ( playerIsQualified )
      {
        const potentialJobData = new PotentialJobData( companyName, jobInfo )
        potentialJobs.push( potentialJobData )
      }
    }
  }

  potentialJobs.sort ( (jobA, jobB) => jobB.jobInfo.salary - jobA.jobInfo.salary )

  ns.tprint( "\n" )
  ns.tprint( "Available Jobs:" )
  for ( let i = 0; i < potentialJobs.length; i++ )
  {
    const potentialJobData = potentialJobs[i]
    ns.tprint( potentialJobData.jobInfo.name + " @ " + potentialJobData.companyName + " paying " + potentialJobData.jobInfo.salary )
  }

  if ( potentialJobs.length > 0 )
  {

    debugger
    const potentialJobData = potentialJobs[0]
    let jobAquired = ns.singularity.applyToCompany( potentialJobData.companyName, potentialJobData.jobInfo.field )

    while ( jobAquired != null )
    {
      if ( jobAquired != potentialJobData.jobInfo.name )
      {
        jobAquired = ns.singularity.applyToCompany( potentialJobs.companyName, potentialJobData.jobInfo.field )
      }
      else
      {
        break
      }
    }
  }

}