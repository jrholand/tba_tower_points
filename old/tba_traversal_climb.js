/**
 * TBA 2026 - Find matches with traversalClimbPoints > 49
 * Run with: node tba_traversal_climb.js
 * Requires Node.js 18+ (uses built-in fetch)
 */

const API_KEY = "vltOFeelWBCK3rTqMG3HHhdStVi8e8KAqxTpm7bPFxcIPnphzIpSgDeZLULcWu5c";
const BASE_URL = "https://www.thebluealliance.com/api/v3";
const THRESHOLD = 49;

const headers = { "X-TBA-Auth-Key": API_KEY };

async function tbaGet(path) {
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) throw new Error(`TBA API error ${res.status} on ${path}`);
  return res.json();
}

async function main() {
  console.log("Fetching 2026 event keys...");
  const eventKeys = await tbaGet("/events/2026/keys");
  console.log(`Found ${eventKeys.length} events. Scanning matches...\n`);

  const results = [];

  for (const eventKey of eventKeys) {
    let matches;
    try {
      matches = await tbaGet(`/event/${eventKey}/matches`);
    } catch (e) {
      console.warn(`  Skipping ${eventKey}: ${e.message}`);
      continue;
    }

    for (const match of matches) {
      const sb = match.score_breakdown;
      if (!sb) continue;

      for (const alliance of ["red", "blue"]) {
        const points = sb[alliance]?.traversalClimbPoints;
        if (typeof points === "number" && points > THRESHOLD) {
          results.push({
            event: eventKey,
            match: match.key,
            comp_level: match.comp_level,
            match_number: match.match_number,
            set_number: match.set_number,
            alliance,
            traversalClimbPoints: points,
            totalScore: sb[alliance]?.totalPoints ?? "N/A",
          });
        }
      }
    }

    process.stdout.write(`  Scanned: ${eventKey}\r`);
  }

  console.log("\n\n=== MATCHES WITH TRAVERSAL CLIMB POINTS > 49 ===\n");

  if (results.length === 0) {
    console.log("No matches found above the threshold.");
    console.log("\nNOTE: If no results appear, the 2026 score breakdown field");
    console.log("may use a different name. Run the debug script below to inspect");
    console.log("the actual field names from a sample match.");
  } else {
    // Sort by points descending
    results.sort((a, b) => b.traversalClimbPoints - a.traversalClimbPoints);

    console.log(
      `${"Match Key".padEnd(30)} ${"Alliance".padEnd(8)} ${"Traversal Pts".padEnd(15)} ${"Total Score"}`
    );
    console.log("-".repeat(70));

    for (const r of results) {
      console.log(
        `${r.match.padEnd(30)} ${r.alliance.padEnd(8)} ${String(r.traversalClimbPoints).padEnd(15)} ${r.totalScore}`
      );
    }

    console.log(`\nTotal matches found: ${results.length}`);
  }

  // --- DEBUG: Print score_breakdown field names from a sample match ---
  console.log("\n=== DEBUG: Sample score_breakdown field names ===");
  try {
    const sampleEvent = eventKeys[0];
    const sampleMatches = await tbaGet(`/event/${sampleEvent}/matches`);
    const sampleWithBreakdown = sampleMatches.find((m) => m.score_breakdown?.red);
    if (sampleWithBreakdown) {
      const fields = Object.keys(sampleWithBreakdown.score_breakdown.red);
      const climbFields = fields.filter((f) => /climb|traversal|endgame/i.test(f));
      console.log(`Event: ${sampleEvent}`);
      console.log(`Match: ${sampleWithBreakdown.key}`);
      console.log("Climb/Traversal/Endgame-related fields:");
      climbFields.forEach((f) => {
        console.log(`  ${f}: ${sampleWithBreakdown.score_breakdown.red[f]}`);
      });
      if (climbFields.length === 0) {
        console.log("  (none found — all 'red' fields:)");
        fields.forEach((f) => console.log(`  ${f}: ${sampleWithBreakdown.score_breakdown.red[f]}`));
      }
    } else {
      console.log("No match with score_breakdown found in sample event.");
    }
  } catch (e) {
    console.warn("Could not fetch debug sample:", e.message);
  }
}

main().catch(console.error);
