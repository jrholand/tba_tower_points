to use call from the commandline but Node must be installed 

It is currently using my API Read Key from the Blue Alliance, but this can be changed by modifying the value for this constant
const API_KEY = "vltOFeelWBCK3rTqMG3HHhdStVi8e8KAqxTpm7bPFxcIPnphzIpSgDeZLULcWu5c";

to get and set your own API key
Go to thebluealliance.com → sign in → Account Dashboard → generate a Read API Key

Install Node:
on Windows, the easiest path:
Download and install Node.js from nodejs.org — grab the LTS version. 
The installer handles everything including adding node to your PATH.
Verify it worked by opening a new Command Prompt and running:

   node --version

Run the script by navigating to the folder where tba_tower_points.js lives and running:

   node tba_tower_points.js

That's it — no npm installs needed since the script only uses Node's built-in fetch and fs. 
Just make sure you're on Node 18 or higher (the current LTS is well above that).
