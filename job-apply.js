/** @param {NS} ns */
export async function main(ns) 
{

  if ( !(ns.singularity) )
  {
    ns.tprint( "You don't have access to the singularity API." )
    ns.tprint( "Terminating script." )
    return
  }

  const companyName = ns.args[0]
  const targetJob   = ns.args[1]

  const player = ns.getPlayer()

  const companyRep  = ns.singularity.getCompanyRep( companyName )
  const jobNames = ns.singularity.getCompanyPositions( companyName )

  if ( !jobNames.includes( targetJob ) )
  {
    ns.tprint( "Job " + targetJob + " could not be found at " + companyName )
    ns.tprint( "Terminating Script." )
    return
  }

  const jobInfo = ns.singularity.getCompanyPositionInfo( companyName, targetJob )

  if ( jobInfo.requiredReputation > companyRep )
  {
    ns.tprint( "Job " + targetJob + " requires " + jobInfo.requiredReputation + " reputation at " + companyName + "." )
    ns.tprint( "You have " + companyRep + " reputation." )
    ns.tprint( "Terminating Script." )
    return
  }
      
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
      ns.tprint( "Job " + targetJob + " requires " + requiredSkillLevel + " " + skillName + " at " + companyName + "." )
      ns.tprint( "You have " + playerSkillLevel + " " + skillName )
    }
  }

  if ( playerIsQualified )
  {
    let jobAquired = ns.singularity.applyToCompany( companyName, jobInfo.field )

    while ( jobAquired != null )
    {
      if ( jobAquired != jobInfo.name )
      {
        jobAquired = ns.singularity.applyToCompany( companyName, jobInfo.field )
      }
      else
      {
        break
      }
    }
  }
  else
  {
    ns.tprint( "You are not qualified to be a " + targetJob + " at " + companyName + "." )
    ns.tprint( "Terminating Script." )
    return
  }
}