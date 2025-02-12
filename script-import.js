//This script recursively nukes all servers in a network we can access, starting from the host computer.

/** @param {NS} ns */
export async function main(ns) 
{
  const localDirectory = "C:/Users/grifb/AppData/Roaming/bitburner/scripts/BitBurnerScripts";

  // List your scripts here
    const scripts = [
      "farm-self.js",
      "farm-server.js",
      "hack-track.js",
      "net-driveby.js",
      "pig-hunt-2.0.js",

      //Personal Server Scripts
      "pserv-buy.js",
      "pserv-exec.js",
      "pserv-upgrade.js",

      //Banking Script
      "redink.js",

      //Brute Forces Servers and Opens All Available Servers in Network To Hacking.
      "R-NUKE.js",

      //Shared Utility Functions
      "utlity.js",

      //This script importer.
      "script-import.js", 
    ];

    const server = "home"; // Target server in Bitburner

    for (const script of scripts) 
    {
        const localPath = `${localDirectory}/${script}`;
        await ns.scp(localPath, server);
        ns.tprint(`Uploaded ${script} to ${server}`)
    }
  
}
