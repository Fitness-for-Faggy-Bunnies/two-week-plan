// Pure calculation helpers. No DOM, no Firebase — testable in Node.
import { ALL_EX, PROFILES, FOCUS, PAIN_AREAS, variantDef } from "./plan.js";
let getProfile = id => PROFILES[id];
export const setProfileSource = fn => { getProfile = fn; };

// Definition for a logged entry (plan exercise or one added by hand).
export function defFor(id, variant, entry = {}) {
  if (ALL_EX[id] && !String(variant || "").startsWith("lib:")) return variantDef(ALL_EX[id], variant);
  return { name: entry.name || id, sr: ALL_EX[id]?.sr || "", kind: entry.kind || "load", db: !!entry.db, q: entry.name || id };
}

export const STEP = 5; // lb increment for weight-bump suggestions

// ---- dates -------------------------------------------------------------
export const pad = n => String(n).padStart(2, "0");
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 864e5);
export function mondayOf(s) { const d = parseYmd(s); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return ymd(d); }
export const fmtDate = s => parseYmd(s).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// Two-week cycle: Week A starts on cycleStart (a Monday), Week B the Monday after.
export function cycleInfo(date, cycleStart) {
  const diff = daysBetween(mondayOf(cycleStart), mondayOf(date));
  const weeks = Math.floor(diff / 7);
  const idx = Math.floor(weeks / 2);
  const start = addDays(mondayOf(cycleStart), idx * 14);
  return { index: idx, start, end: addDays(start, 13), week: ((weeks % 2) + 2) % 2 === 0 ? "A" : "B" };
}

// ---- sets --------------------------------------------------------------
export function parseRange(sr) {
  const m = String(sr).match(/(\d+)\s*×\s*(\d+)(?:\s*[–-]\s*(\d+))?/);
  if (!m) { const s = String(sr).match(/(\d+)\s*×/); return { sets: s ? +s[1] : 3, min: null, max: null }; }
  return { sets: +m[1], min: +m[2], max: m[3] ? +m[3] : +m[2] };
}

export const e1rm = (w, r) => (w > 0 ? w * (1 + r / 30) : r);

// One comparable number per logged exercise. Higher is better, except assist (lower assist is better).
export function bestScore(kind, sets) {
  const ok = (sets || []).filter(s => (s.r || 0) > 0 || (s.w || 0) > 0);
  if (!ok.length) return null;
  switch (kind) {
    case "load": return Math.max(...ok.map(s => e1rm(s.w || 0, s.r || 0)));
    case "carry": return Math.max(...ok.map(s => (s.w || 0) * 100 + (s.r || 0) / 100));
    case "assist": return Math.min(...ok.map(s => s.w || 0));
    default: return Math.max(...ok.map(s => s.r || 0)); // bw, time
  }
}
export const betterThan = (kind, a, b) => (b == null ? a != null : a != null && (kind === "assist" ? a < b : a > b));

export function unitLabel(kind, db) {
  if (kind === "time") return { w: null, r: "sec" };
  if (kind === "bw") return { w: null, r: "reps" };
  if (kind === "carry") return { w: db ? "lb each" : "lb", r: "steps" };
  if (kind === "assist") return { w: "lb assist", r: "reps" };
  return { w: db ? "lb each" : "lb", r: "reps" };
}

export function describeSets(kind, db, sets) {
  const u = unitLabel(kind, db);
  const parts = (sets || []).map(s => (u.w ? `${s.w || 0}×${s.r || 0}` : `${s.r || 0}`));
  const tail = u.w ? `${u.w}` : u.r;
  return parts.length ? `${parts.join(", ")} ${tail}` : "—";
}

export function topSetText(kind, db, sets) {
  const u = unitLabel(kind, db);
  if (!sets || !sets.length) return "—";
  if (!u.w) return `${Math.max(...sets.map(s => s.r || 0))} ${u.r}`;
  const pick = kind === "assist"
    ? sets.reduce((a, b) => ((b.w || 0) < (a.w || 0) ? b : a))
    : sets.reduce((a, b) => ((b.w || 0) > (a.w || 0) || ((b.w || 0) === (a.w || 0) && (b.r || 0) > (a.r || 0)) ? b : a));
  return `${pick.w || 0} ${u.w} × ${pick.r || 0} ${u.r}`;
}

// ---- history ------------------------------------------------------------
export const userSessions = (sessions, user) =>
  sessions.filter(s => s.user === user).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.updatedAt || 0) - (b.updatedAt || 0)));

// Entries for one exercise (optionally one variant), oldest first.
export function exHistory(sessions, user, exId, variant) {
  const out = [];
  for (const s of userSessions(sessions, user)) for (const e of s.exercises || []) {
    if (e.id !== exId || e.skipped) continue;
    if (variant && (e.variant || "std") !== variant) continue;
    out.push({ date: s.date, sessionId: s.id, ...e, score: bestScore(e.kind, e.sets) });
  }
  return out;
}

export function lastTime(sessions, user, exId, variant) {
  const h = exHistory(sessions, user, exId, variant);
  return h.length ? h[h.length - 1] : null;
}

export function personalBest(sessions, user, exId, variant, beforeOrOn) {
  let best = null;
  for (const e of exHistory(sessions, user, exId, variant)) {
    if (beforeOrOn && e.date > beforeOrOn) continue;
    if (betterThan(e.kind, e.score, best?.score)) best = e;
  }
  return best;
}

// Automatic weight-bump prompt: every set at the top of the range, two sessions in a row.
export function suggestion(sessions, user, exId, variant) {
  const ex = ALL_EX[exId]; if (!ex || String(variant || "").startsWith("lib:")) return null;
  const def = variantDef(ex, variant === "hard" ? "hard" : "std");
  const { max, min } = parseRange(def.sr);
  const h = exHistory(sessions, user, exId, variant).slice(-2);
  if (!h.length) return null;
  const last = h[h.length - 1];
  const topW = Math.max(0, ...last.sets.map(s => s.w || 0));
  const each = def.db ? " each" : "";
  const hitTop = e => max != null && e.sets.length > 0 && e.sets.every(s => (s.r || 0) >= max);
  const wayOver = max != null && last.sets.length > 0 && last.sets.every(s => (s.r || 0) >= max + 4) && (def.kind === "load" || def.kind === "carry");
  if (wayOver) return { type: "up", text: `${Math.min(...last.sets.map(s => s.r || 0))}+ reps on every set is well past the ${max}-rep target, so this weight is too light. Try ${topW + STEP * 2} lb${each} next time.` };
  if (h.length === 2 && hitTop(h[0]) && hitTop(h[1])) {
    switch (def.kind) {
      case "load": return { type: "up", text: `You hit ${max}+ reps on every set twice. Try ${topW + STEP} lb${each} next time.` };
      case "carry": return { type: "up", text: `You finished every carry twice. Try ${topW + STEP} lb${each} next time.` };
      case "assist": return { type: "up", text: `You hit ${max}+ reps twice. Try ${Math.max(0, topW - STEP)} lb of assist next time.` };
      case "time": return { type: "up", text: `You held ${max}+ seconds every set twice. Add 10 seconds next time.` };
      default: return { type: "up", text: ex.h && variant !== "hard" ? `You hit ${max}+ reps twice. Try the harder version next time.` : `You hit ${max}+ reps twice. Add 2 reps per set, or slow each rep down.` };
    }
  }
  if (min != null && last.sets.length && last.sets.every(s => (s.d || 2) === 3) && last.sets.some(s => (s.r || 0) < min) && (def.kind === "load" || def.kind === "carry")) {
    return { type: "hold", text: `Every set felt hard and some fell short of ${min} reps. Stay at ${topW} lb${each}, or drop ${STEP} lb.` };
  }
  return null;
}

// Hard sets per focus area per week (difficulty "right" or "hard").
export function setsByFocus(sessions, user, from, to) {
  const weeks = {};
  for (const s of userSessions(sessions, user)) {
    if ((from && s.date < from) || (to && s.date > to)) continue;
    const wk = mondayOf(s.date);
    weeks[wk] = weeks[wk] || {};
    for (const e of s.exercises || []) {
      if (e.skipped) continue;
      const focus = ALL_EX[e.id]?.focus || e.focus || [];
      const n = (e.sets || []).filter(x => (x.d || 2) >= 2).length;
      for (const f of focus) weeks[wk][f] = (weeks[wk][f] || 0) + n;
    }
  }
  return weeks;
}

// ---- body ---------------------------------------------------------------
export const BODY_FIELDS = {
  weight: { label: "Body weight", unit: "lb" },
  waist: { label: "Waist", unit: "in" },
  hips: { label: "Hips / glutes", unit: "in" },
  chest: { label: "Chest", unit: "in" },
  thigh: { label: "Thigh", unit: "in" },
  arm: { label: "Upper arm", unit: "in" },
  restingHr: { label: "Resting heart rate", unit: "bpm" },
  vo2: { label: "VO2 max (watch estimate)", unit: "" },
  fit: { label: "How clothes fit (1–5)", unit: "" }
};
// Lower is the goal for these.
export const LOWER_IS_BETTER = new Set(["weight", "waist", "restingHr"]);
export const HIGHER_IS_BETTER = new Set(["vo2", "fit"]);
// Hips, chest, thigh, and arm can move either way for good reasons (fat loss vs. muscle), so they get no color.
export function trendClass(f, change) {
  if (!change) return "";
  if (LOWER_IS_BETTER.has(f)) return change < 0 ? "good" : "bad";
  if (HIGHER_IS_BETTER.has(f)) return change > 0 ? "good" : "bad";
  return "";
}

export function bodyAt(body, user, date, field) {
  let pick = null;
  for (const b of body) if (b.user === user && b.date <= date && b[field] != null && b[field] !== "" && (!pick || b.date >= pick.date)) pick = b;
  return pick ? { value: +pick[field], date: pick.date } : null;
}
export function movingAvg(values, n = 7) {
  return values.map((_, i) => { const w = values.slice(Math.max(0, i - n + 1), i + 1); return +(w.reduce((a, b) => a + b, 0) / w.length).toFixed(1); });
}

// ---- cardio -------------------------------------------------------------
export function cardioTotals(sessions, activities, user, from, to) {
  const t = { gymMinutes: 0, gymDays: 0, hiit: 0, commuteMiles: 0, commuteDays: 0, byType: {} };
  for (const s of userSessions(sessions, user)) {
    if (s.date < from || s.date > to || !s.cardio?.done) continue;
    t.gymDays++; t.gymMinutes += +s.cardio.minutes || 0; if (s.cardio.hiit) t.hiit++;
    t.byType[s.cardio.type || "Other"] = (t.byType[s.cardio.type || "Other"] || 0) + (+s.cardio.minutes || 0);
  }
  for (const a of activities) {
    if (a.user !== user || a.date < from || a.date > to) continue;
    if (a.type === "Bike commute") { t.commuteMiles += +a.miles || 0; t.commuteDays++; }
  }
  t.commuteMiles = +t.commuteMiles.toFixed(1);
  return t;
}

// ---- end-of-cycle report -------------------------------------------------
export function workoutDaysBetween(from, to) {
  let n = 0; for (let d = from; d <= to; d = addDays(d, 1)) { const dow = parseYmd(d).getDay(); if (dow >= 1 && dow <= 4) n++; }
  return n;
}
export function cycleReport({ sessions, body, activities, user, start, end, today }) {
  const mine = userSessions(sessions, user).filter(s => s.date >= start && s.date <= end && (s.exercises || []).some(e => !e.skipped && e.sets?.length));
  const days = [...new Set(mine.map(s => s.date))];
  const soFar = workoutDaysBetween(start, today && today < end ? today : end);
  const exIds = [...new Set(mine.flatMap(s => (s.exercises || []).filter(e => !e.skipped).map(e => `${e.id}|${e.variant || "std"}`)))];
  const up = [], stalled = [], newEx = [];
  for (const key of exIds) {
    const [id, variant] = key.split("|");
    const hist0 = exHistory(sessions, user, id, variant);
    const def = defFor(id, variant, hist0[hist0.length - 1]);
    const before = personalBest(sessions, user, id, variant, addDays(start, -1));
    const hist = exHistory(sessions, user, id, variant).filter(e => e.date >= start && e.date <= end);
    let inCycle = null; for (const e of hist) if (betterThan(e.kind, e.score, inCycle?.score)) inCycle = e;
    const last = hist[hist.length - 1];
    const row = { id, variant, name: def.name, kind: def.kind, db: def.db, top: topSetText(last.kind, last.db, last.sets), sets: setsText(last), before: before ? topSetText(before.kind, before.db, before.sets) : null, times: hist.length };
    if (!before) newEx.push(row);
    else if (betterThan(def.kind, inCycle?.score, before.score)) up.push(row);
    else stalled.push(row);
  }
  const areas = getProfile(user).pain;
  const pain = {};
  for (const a of areas) {
    const vals = mine.map(s => s.pain?.[a]).filter(v => v != null && v !== "");
    pain[a] = vals.length ? { avg: +(vals.reduce((x, y) => x + +y, 0) / vals.length).toFixed(1), max: Math.max(...vals.map(Number)) } : null;
  }
  const painDays = mine.filter(s => areas.some(a => (+s.pain?.[a] || 0) >= 4)).map(s => ({
    date: s.date, day: s.day, areas: areas.filter(a => (+s.pain?.[a] || 0) >= 4).map(a => `${PAIN_AREAS[a]} ${s.pain[a]}/10`),
    exercises: (s.exercises || []).filter(e => !e.skipped).map(e => e.name)
  }));
  const diff = { 1: 0, 2: 0, 3: 0 };
  for (const s of mine) for (const e of s.exercises || []) for (const x of e.sets || []) diff[x.d || 2]++;
  const bodyChange = {};
  for (const f of Object.keys(BODY_FIELDS)) {
    const a = bodyAt(body, user, addDays(start, -1), f) || firstIn(body, user, f, start, end);
    const b = bodyAt(body, user, end, f);
    if (a && b && a.date !== b.date) bodyChange[f] = { from: a.value, to: b.value, change: +(b.value - a.value).toFixed(1) };
  }
  const rec = {};
  for (const k of ["sleep", "energy", "soreness"]) {
    const v = mine.map(s => s.recovery?.[k]).filter(Boolean).map(Number);
    rec[k] = v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : null;
  }
  const detail = days.map(d => {
    const ss = mine.filter(s => s.date === d); const s0 = ss[0];
    const seen = new Set(); const exs = [];
    for (const s of ss) for (const e of s.exercises || []) { if (e.skipped || !e.sets?.length || seen.has(e.id + e.variant)) continue; seen.add(e.id + e.variant); exs.push(e); }
    const cardio = ss.map(s => s.cardio).find(c => c?.done);
    return { date: d, week: s0.week, day: s0.day, exercises: exs, cardio, notes: ss.map(s => s.notes).filter(Boolean).join(" ") };
  });
  return {
    user, start, end, sessions: days.length, planned: 8, soFar, detail, today,
    up, stalled, newEx, pain, painDays, diff, bodyChange, recovery: rec,
    cardio: cardioTotals(sessions, activities, user, start, end),
    notes: mine.filter(s => s.notes).map(s => `${s.date}: ${s.notes}`)
  };
}
function firstIn(body, user, f, start, end) {
  const xs = body.filter(b => b.user === user && b.date >= start && b.date <= end && b[f] != null && b[f] !== "").sort((a, b) => (a.date < b.date ? -1 : 1));
  return xs.length ? { value: +xs[0][f], date: xs[0].date } : null;
}

// "3 sets: 35×12, 35×12, 35×10 lb (R R H)"
export function setsText(e) {
  const sets = e.sets || []; const u = unitLabel(e.kind, e.db);
  const vals = sets.map(s => (u.w ? `${s.w || 0}×${s.r || 0}` : `${s.r || 0}`)).join(", ");
  const felt = sets.map(s => ["", "E", "R", "H"][s.d || 2]).join(" ");
  return `${sets.length} set${sets.length === 1 ? "" : "s"}: ${vals} ${u.w || u.r} (${felt})`;
}
export function reportText(r) {
  const p = getProfile(r.user);
  const L = [];
  L.push(`Two-Week Split — end-of-cycle report for ${p.name}`);
  L.push(`Cycle: ${r.start} to ${r.end}. Goals: ${p.focusNote}`);
  const inProgress = r.today && r.today < r.end;
  L.push(inProgress ? `Cycle in progress. Workout days logged: ${r.sessions} of ${r.soFar} so far (${r.planned} in the full cycle).` : `Workout days logged: ${r.sessions} of ${r.planned}.`);
  L.push("");
  L.push("WENT UP:"); r.up.length ? r.up.forEach(x => L.push(`- ${x.name}: best before ${x.before}, now ${x.sets}`)) : L.push("- none");
  L.push("STALLED (no new best this cycle):"); r.stalled.length ? r.stalled.forEach(x => L.push(`- ${x.name}: best before ${x.before}, latest ${x.sets}`)) : L.push("- none");
  if (r.newEx.length) { L.push("FIRST TIME LOGGED:"); r.newEx.forEach(x => L.push(`- ${x.name}: ${x.sets}`)); }
  L.push("");
  L.push("EVERY WORKOUT THIS CYCLE (weight × reps per set, felt E/R/H = easy/right/hard):");
  for (const d of r.detail) {
    L.push(`${d.date} — Week ${d.week} ${d.day}:`);
    for (const e of d.exercises) L.push(`- ${e.name}${e.variant === "hard" ? " (harder)" : e.variant === "swap" ? " (swap)" : String(e.variant).startsWith("lib:") ? ` (library swap for ${ALL_EX[e.id]?.n || "planned exercise"})` : e.added ? " (added)" : ""}: ${setsText(e)}`);
    if (d.cardio) L.push(`- Cardio: ${d.cardio.type || "?"}, ${d.cardio.minutes || 0} min${d.cardio.miles ? `, ${d.cardio.miles} mi` : ""}${d.cardio.avgHr ? `, avg HR ${d.cardio.avgHr}` : ""}${d.cardio.hiit ? ", intervals" : ""}`);
    if (d.notes) L.push(`- Notes: ${d.notes}`);
  }
  L.push("");
  L.push("PAIN (0–10, average / max):");
  Object.entries(r.pain).forEach(([a, v]) => L.push(`- ${PAIN_AREAS[a]}: ${v ? `${v.avg} / ${v.max}` : "not logged"}`));
  if (r.painDays.length) { L.push("Days with pain 4+:"); r.painDays.forEach(d => L.push(`- ${d.date} (${d.day}): ${d.areas.join(", ")}. Exercises: ${d.exercises.join(", ")}`)); }
  L.push("");
  const tot = r.diff[1] + r.diff[2] + r.diff[3];
  if (tot) L.push(`Set difficulty: ${Math.round(r.diff[1] / tot * 100)}% easy, ${Math.round(r.diff[2] / tot * 100)}% just right, ${Math.round(r.diff[3] / tot * 100)}% hard.`);
  const c = r.cardio;
  L.push(`Cardio: ${c.gymDays} gym sessions, ${c.gymMinutes} min total, ${c.hiit} interval sessions.${c.commuteDays ? ` Bike commutes: ${c.commuteDays} day${c.commuteDays === 1 ? "" : "s"}, ${c.commuteMiles} miles.` : ""}`);
  const bc = Object.entries(r.bodyChange);
  if (bc.length) { L.push("Body changes:"); bc.forEach(([f, v]) => L.push(`- ${BODY_FIELDS[f].label}: ${v.from} → ${v.to} ${BODY_FIELDS[f].unit} (${v.change > 0 ? "+" : ""}${v.change})`)); }
  const rc = r.recovery;
  if (rc.sleep || rc.energy || rc.soreness) L.push(`Recovery averages (1–5): sleep ${rc.sleep ?? "–"}, energy ${rc.energy ?? "–"}, soreness ${rc.soreness ?? "–"}.`);
  L.push("");
  L.push("Please suggest adjustments to my Two-Week Split for the next cycle based on this.");
  return L.join("\n");
}

// ---- before & after -----------------------------------------------------
export function compare({ sessions, body, activities, user, a, b }) {
  const [from, to] = a <= b ? [a, b] : [b, a];
  const bodyRows = Object.keys(BODY_FIELDS).map(f => {
    const x = bodyAt(body, user, from, f), y = bodyAt(body, user, to, f);
    return x || y ? { f, label: BODY_FIELDS[f].label, unit: BODY_FIELDS[f].unit, a: x, b: y, change: x && y ? +(y.value - x.value).toFixed(1) : null } : null;
  }).filter(Boolean);
  const keys = [...new Set(userSessions(sessions, user).flatMap(s => (s.exercises || []).filter(e => !e.skipped).map(e => `${e.id}|${e.variant || "std"}`)))];
  const lifts = keys.map(k => {
    const [id, v] = k.split("|");
    const hh = exHistory(sessions, user, id, v); const def = defFor(id, v, hh[hh.length - 1]);
    const x = personalBest(sessions, user, id, v, from), y = personalBest(sessions, user, id, v, to);
    if (!y) return null;
    const pct = x && x.score && y.score ? Math.round(((def.kind === "assist" ? x.score - y.score : y.score - x.score) / Math.abs(x.score)) * 100) : null;
    return { name: def.name, a: x ? topSetText(x.kind, x.db, x.sets) : "—", b: topSetText(y.kind, y.db, y.sets), pct };
  }).filter(Boolean).sort((p, q) => (q.pct ?? -999) - (p.pct ?? -999));
  const between = userSessions(sessions, user).filter(s => s.date > from && s.date <= to).length;
  return { from, to, bodyRows, lifts, between, cardio: cardioTotals(sessions, activities, user, addDays(from, 1), to) };
}

export { FOCUS };
