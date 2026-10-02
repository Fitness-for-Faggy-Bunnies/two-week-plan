// Unit tests for the progress math. Run with:  node tests/run.mjs
// No packages needed. Copies the js/ modules into a temp folder as ES modules.
import { mkdtempSync, readdirSync, copyFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "twp-"));
for (const f of readdirSync(join(here, "../js"))) if (f.endsWith(".js") && !["app.js", "firebase.js"].includes(f)) copyFileSync(join(here, "../js", f), join(dir, f));
writeFileSync(join(dir, "package.json"), '{"type":"module"}');
const S = await import(join(dir, "stats.js"));
const F = await import(join(dir, "fun.js"));
const { ALL_EX } = await import(join(dir, "plan.js"));
const { BUILTIN, STRETCH_BY_FOCUS } = await import(join(dir, "library.js"));
const { PLAN_SAFETY, safetyFor } = await import(join(dir, "safety.js"));
const { STRETCH } = await import(join(dir, "plan.js"));

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  if (!ok) console.log(`FAIL ${name}\n  got:  ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`);
};
const yes = (name, v) => eq(name, !!v, true);

// ---- ranges
eq("range 3 × 10–12", S.parseRange("3 × 10–12"), { sets: 3, min: 10, max: 12 });
eq("range per leg", S.parseRange("3 × 8 per leg"), { sets: 3, min: 8, max: 8 });
eq("range seconds", S.parseRange("3 × 20–30 sec"), { sets: 3, min: 20, max: 30 });
eq("range max", S.parseRange("3 × max"), { sets: 3, min: null, max: null });
eq("range hyphen", S.parseRange("4 × 8-10"), { sets: 4, min: 8, max: 10 });

// ---- dates and cycles
eq("monday of a Sunday", S.mondayOf("2026-10-04"), "2026-09-28");
eq("monday of a Monday", S.mondayOf("2026-09-28"), "2026-09-28");
eq("days across DST end", S.daysBetween("2026-10-31", "2026-11-02"), 2);
eq("days across DST start", S.daysBetween("2027-03-13", "2027-03-15"), 2);
eq("week A first week", S.cycleInfo("2026-09-30", "2026-09-28").week, "A");
eq("week B second week", S.cycleInfo("2026-10-07", "2026-09-28").week, "B");
eq("week A third week", S.cycleInfo("2026-10-12", "2026-09-28").week, "A");
eq("cycle across new year", S.cycleInfo("2027-01-11", "2026-09-28"), { index: 7, start: "2027-01-04", end: "2027-01-17", week: "B" });
eq("before cycle start", S.cycleInfo("2026-09-21", "2026-09-28").week, "B");
eq("workout days in a week", S.workoutDaysBetween("2026-09-28", "2026-10-04"), 4);

// ---- scores
eq("e1rm", Math.round(S.e1rm(100, 10)), 133);
eq("best load", Math.round(S.bestScore("load", [{ w: 40, r: 10 }, { w: 45, r: 6 }])), 54);
eq("best assist is lowest", S.bestScore("assist", [{ w: 50, r: 8 }, { w: 40, r: 6 }]), 40);
yes("assist lower is better", S.betterThan("assist", 30, 40));
yes("time higher is better", S.betterThan("time", 45, 30));
eq("empty sets", S.bestScore("load", []), null);

// ---- helpers for sessions
const ses = (date, id, sets, o = {}) => ({ id: `mat_${date}`, user: "mat", date, week: "A", day: "Mon", exercises: [{ id, variant: o.v || "std", name: o.name || id, kind: o.kind || "load", db: !!o.db, sets }], ...o.extra });
const set = (w, r, d = 2) => ({ w, r, d });

// ---- weight-bump prompts
let h = [ses("2026-09-14", "a-mon-sp", [set(40, 10), set(40, 10)]), ses("2026-09-21", "a-mon-sp", [set(40, 10), set(40, 11)])];
yes("bump after two top sessions", S.suggestion(h, "mat", "a-mon-sp", "std")?.text.includes("45 lb"));
h = [ses("2026-09-14", "a-mon-sp", [set(40, 10), set(40, 9)]), ses("2026-09-21", "a-mon-sp", [set(40, 10), set(40, 10)])];
eq("no bump if one session fell short", S.suggestion(h, "mat", "a-mon-sp", "std"), null);
h = [ses("2026-09-14", "a-wed-ht", [set(20, 20), set(20, 20)])];
yes("way over target bumps right away", S.suggestion(h, "mat", "a-wed-ht", "std")?.text.includes("30 lb"));
h = [ses("2026-09-14", "a-mon-cp", [set(80, 7, 3), set(80, 6, 3)])];
yes("too heavy says hold", S.suggestion(h, "mat", "a-mon-cp", "std")?.type === "hold");
h = [ses("2026-09-14", "a-tue-pu", [set(50, 10), set(50, 10)], { kind: "assist" }), ses("2026-09-21", "a-tue-pu", [set(50, 10), set(50, 10)], { kind: "assist" })];
yes("assist bump lowers assist", S.suggestion(h, "mat", "a-tue-pu", "std")?.text.includes("45 lb of assist"));
h = [ses("2026-09-14", "a-thu-bug", [set(0, 8), set(0, 8)], { kind: "bw" }), ses("2026-09-21", "a-thu-bug", [set(0, 8), set(0, 8)], { kind: "bw" })];
yes("bodyweight suggests harder version", S.suggestion(h, "mat", "a-thu-bug", "std")?.text.includes("harder"));
eq("library swap gets no prompt", S.suggestion(h, "mat", "a-thu-bug", "lib:db-fly"), null);

// ---- reports
const two = [ses("2026-09-30", "a-wed-ht", [set(35, 12), set(35, 12), set(35, 10, 3)]), { ...ses("2026-09-30", "custom-hip-adductor", [set(90, 15)], { kind: "load", name: "Hip Adductor Machine" }), id: "dup" }];
const r = S.cycleReport({ sessions: two, body: [], activities: [], user: "mat", start: "2026-09-28", end: "2026-10-11", today: "2026-09-30" });
eq("report counts distinct days", r.sessions, 1);
eq("report planned so far", r.soFar, 3);
yes("report includes custom exercise", r.newEx.some(x => x.name === "Hip Adductor Machine"));
yes("report text lists every set", S.reportText(r).includes("3 sets: 35×12, 35×12, 35×10 lb (R R H)"));
yes("report text says in progress", S.reportText(r).includes("Cycle in progress"));
const cmp = S.compare({ sessions: two, body: [{ user: "mat", date: "2026-09-20", waist: 42 }], activities: [], user: "mat", a: "2026-09-01", b: "2026-10-01" });
eq("compare body with only one side", cmp.bodyRows[0].change, null);

// ---- fun
eq("volume doubles for dumbbells", F.volumeOf({ kind: "load", db: true, sets: [set(20, 10)] }), 400);
eq("volume for a machine", F.volumeOf({ kind: "load", db: false, sets: [set(100, 10)] }), 1000);
eq("no volume for time", F.volumeOf({ kind: "time", sets: [set(0, 30)] }), 0);
eq("fun weight", F.funWeight(2060), "about 1.9 horses");
eq("fun weight tiny", F.funWeight(40), "");
const weeks = [];
for (const mon of ["2026-09-07", "2026-09-14", "2026-09-21"]) for (let i = 0; i < 3; i++) weeks.push(ses(S.addDays(mon, i), "a-mon-cp", [set(50, 10)]));
const st = F.streaks(weeks, "mat", "2026-09-28");
eq("streak counts back from last full week", [st.current, st.longest], [3, 3]);
eq("records", F.prEvents([ses("2026-09-01", "a-mon-cp", [set(50, 10)]), ses("2026-09-08", "a-mon-cp", [set(55, 10)]), ses("2026-09-15", "a-mon-cp", [set(50, 10)])], "mat").length, 1);
eq("level", F.level(1200).name, "Grinder");
const got = F.earnedBadges(weeks, [], [], "mat", "2026-09-28");
yes("first workout badge", got.has("first"));
yes("not ten yet", !got.has("w10") || weeks.length >= 10);

// ---- content cross-checks
const stretchKeys = new Set(Object.keys(STRETCH));
for (const e of Object.values(ALL_EX)) {
  for (const k of e.s) yes(`stretch key ${k} on ${e.id}`, stretchKeys.has(k));
  yes(`safety info for ${e.id}`, PLAN_SAFETY[e.id]);
  yes(`swap for ${e.id}`, e.swap?.n && e.swap?.how);
  for (const v of ["std", "hard", "swap"]) yes(`safety resolves ${e.id}/${v}`, safetyFor(e, v));
}
for (const f of Object.values(STRETCH_BY_FOCUS)) for (const k of f) yes(`focus stretch ${k}`, stretchKeys.has(k));
// Every stretch says where you feel it and what it does; held stretches have a timer length that matches their label.
for (const [k, st] of Object.entries(STRETCH)) {
  yes(`stretch ${k} has feel + purpose`, st.f?.length > 20 && st.g?.length > 20);
  const held = /sec/.test(st.t);
  yes(`stretch ${k} timer matches label`, held ? st.sec > 0 && st.t.includes(String(st.sec)) : st.sec === 0);
}
const ids = new Set();
for (const b of BUILTIN) {
  yes(`unique library id ${b.id}`, !ids.has(b.id)); ids.add(b.id);
  yes(`library ${b.id} has risks`, b.risks.length > 0);
  yes(`library ${b.id} has a range`, S.parseRange(b.sr).max != null);
  for (const r of b.risks) yes(`library ${b.id} risk has advice`, r.risk && r.avoid);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
