/**
 * TBA 2026 - Track ALL matches with Tower Points / Traversal Tower Points
 * Produces a full sorted report (highest first) + top 10 summary
 *
 * Run with: node tba_tower_points.js
 * Requires Node.js 18+ (built-in fetch, no npm needed)
 * Output: console + tba_tower_points_report.txt
 */

const API_KEY = "vltOFeelWBCK3rTqMG3HHhdStVi8e8KAqxTpm7bPFxcIPnphzIpSgDeZLULcWu5c";
const BASE_URL = "https://www.thebluealliance.com/api/v3";
const headers = { "X-TBA-Auth-Key": API_KEY };
const fs = require("fs");

// Candidate field names to check — will auto-detect from first match found
const TOWER_FIELD_CANDIDATES = [
  "traversalTowerPoints",
  "towerPoints",
  "endGameTowerPoints",
  "totalTowerPoints",
  "traversalClimbPoints",
  "endgameTowerPoints",
  "traversal_tower_points",
  "tower_points",
];

async function tbaGet(path) {
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return res.json();
}

function detectTowerField(scoreBreakdown) {
  // Check red or blue side
  for (const alliance of ["red", "blue"]) {
    const side = scoreBreakdown?.[alliance];
    if (!side) continue;
    for (const candidate of TOWER_FIELD_CANDIDATES) {
      if (typeof side[candidate] === "number") return candidate;
    }
    // Fallback: find anything with 'tower' in name
    const towerKey = Object.keys(side).find((k) => /tower/i.test(k));
    if (towerKey) return towerKey;
  }
  return null;
}

function pad(str, len) {
  return String(str ?? "").padEnd(len).slice(0, len);
}

function compLevelLabel(level, set, num) {
  if (level === "qm") return `Qual ${num}`;
  if (level === "qf") return `QF ${set}-${num}`;
  if (level === "sf") return `SF ${set}-${num}`;
  if (level === "f")  return `Final ${num}`;
  return `${level} ${set}-${num}`;
}

async function main() {
  console.log("Fetching 2026 event keys...");
  const eventKeys = await tbaGet("/events/2026/keys");
  // Filter to official competition events (exclude off-season keys if desired)
  const compKeys = eventKeys.filter((k) => /^2026[a-z]/.test(k));
  console.log(`Found ${compKeys.length} events. Scanning all matches...\n`);

  let detectedField = null;
  const allResults = [];
  let totalMatchesScanned = 0;
  let eventsWithData = 0;

  for (let i = 0; i < compKeys.length; i++) {
    const eventKey = compKeys[i];
    process.stdout.write(`  [${i + 1}/${compKeys.length}] ${eventKey}...        \r`);

    let matches;
    try {
      matches = await tbaGet(`/event/${eventKey}/matches`);
    } catch (e) {
      continue;
    }

    let eventHadData = false;
    for (const match of matches) {
      const sb = match.score_breakdown;
      if (!sb) continue;
      totalMatchesScanned++;

      // Auto-detect field name on first match with a breakdown
      if (!detectedField) {
        detectedField = detectTowerField(sb);
        if (detectedField) {
          console.log(`\n  ✓ Detected tower field: "${detectedField}"\n`);
        }
      }

      if (!detectedField) continue;

      for (const alliance of ["red", "blue"]) {
        const pts = sb[alliance]?.[detectedField];
        if (typeof pts === "number" && pts > 0) {
          allResults.push({
            eventKey,
            matchKey: match.key,
            compLevel: match.comp_level,
            setNumber: match.set_number,
            matchNumber: match.match_number,
            alliance,
            towerPoints: pts,
            totalScore: sb[alliance]?.totalPoints ?? sb[alliance]?.total_points ?? "?",
            redScore: match.alliances?.red?.score ?? "?",
            blueScore: match.alliances?.blue?.score ?? "?",
            label: compLevelLabel(match.comp_level, match.set_number, match.match_number),
          });
          eventHadData = true;
        }
      }
    }
    if (eventHadData) eventsWithData++;
  }

  console.log(`\n\nScan complete.`);
  console.log(`  Events scanned: ${compKeys.length}`);
  console.log(`  Events with tower point data: ${eventsWithData}`);
  console.log(`  Total match-alliance entries scanned: ${totalMatchesScanned}`);
  console.log(`  Tower point entries found (>0): ${allResults.length}`);
  console.log(`  Field used: "${detectedField ?? "NOT DETECTED"}"\n`);

  if (!detectedField || allResults.length === 0) {
    // Print all fields from a sample for debugging
    console.log("⚠️  No tower points data found. Printing sample score_breakdown fields...");
    for (const eventKey of compKeys.slice(0, 3)) {
      try {
        const matches = await tbaGet(`/event/${eventKey}/matches`);
        const sample = matches.find((m) => m.score_breakdown?.red);
        if (sample) {
          console.log(`\nSample from ${sample.key}:`);
          Object.entries(sample.score_breakdown.red).forEach(([k, v]) =>
            console.log(`  ${k}: ${v}`)
          );
          break;
        }
      } catch {}
    }
    return;
  }

  // Sort by tower points descending, then total score descending as tiebreak
  allResults.sort((a, b) => b.towerPoints - a.towerPoints || b.totalScore - a.totalScore);

  // ── Build report ──────────────────────────────────────────────────────────
  const lines = [];
  const hr = "═".repeat(80);
  const hr2 = "─".repeat(80);

  lines.push(hr);
  lines.push("  FRC 2026 — TOWER POINTS MATCH REPORT");
  lines.push(`  Field: "${detectedField}"  |  Generated: ${new Date().toLocaleString()}`);
  lines.push(hr);
  lines.push(`  Total entries with tower points > 0: ${allResults.length}`);
  lines.push(`  Events with data: ${eventsWithData} of ${compKeys.length}`);
  lines.push("");

  // TOP 10 SUMMARY
  lines.push("┌" + "─".repeat(78) + "┐");
  lines.push("│" + "  TOP 10 HIGHEST TOWER POINT PERFORMANCES".padEnd(78) + "│");
  lines.push("└" + "─".repeat(78) + "┘");
  lines.push("");
  lines.push(
    `  ${"#".padEnd(4)}${"Match".padEnd(28)}${"Alliance".padEnd(10)}${"Tower Pts".padEnd(12)}${"Total Score"}`
  );
  lines.push("  " + hr2);

  const top10 = allResults.slice(0, 10);
  top10.forEach((r, idx) => {
    lines.push(
      `  ${String(idx + 1).padEnd(4)}${pad(r.matchKey, 28)}${pad(r.alliance.toUpperCase(), 10)}${pad(r.towerPoints, 12)}${r.totalScore}`
    );
  });

  lines.push("");
  lines.push(`  Top 10 average tower points: ${(top10.reduce((s, r) => s + r.towerPoints, 0) / top10.length).toFixed(1)}`);
  lines.push(`  Overall average tower points: ${(allResults.reduce((s, r) => s + r.towerPoints, 0) / allResults.length).toFixed(1)}`);
  lines.push(`  Highest single performance: ${allResults[0]?.towerPoints ?? "N/A"} pts`);

  lines.push("");
  lines.push(hr);
  lines.push("  FULL MATCH LIST — ALL ENTRIES SORTED BY TOWER POINTS (HIGHEST FIRST)");
  lines.push(hr);
  lines.push("");
  lines.push(
    `  ${"Rank".padEnd(6)}${"Match Key".padEnd(30)}${"Event".padEnd(14)}${"Stage".padEnd(12)}${"Alliance".padEnd(10)}${"Tower Pts".padEnd(11)}${"Total Score"}`
  );
  lines.push("  " + "─".repeat(78));

  allResults.forEach((r, idx) => {
    lines.push(
      `  ${String(idx + 1).padEnd(6)}${pad(r.matchKey, 30)}${pad(r.eventKey, 14)}${pad(r.label, 12)}${pad(r.alliance.toUpperCase(), 10)}${pad(r.towerPoints, 11)}${r.totalScore}`
    );
  });

  lines.push("");
  lines.push(hr);
  lines.push(`  END OF REPORT — ${allResults.length} entries`);
  lines.push(hr);

  const report = lines.join("\n");
  console.log(report);

  // Write to file
  const outFile = "tba_tower_points_report.txt";
  fs.writeFileSync(outFile, report, "utf8");
  console.log(`\n✓ Report saved to: ${outFile}`);
}

main().catch(console.error);
