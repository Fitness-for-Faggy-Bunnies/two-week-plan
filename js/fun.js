// The fun layer: voice lines, celebrations, badges, points, levels.
import * as S from "./stats.js";

// ---------------------------------------------------------------- how the app talks
const LINES = {
  hype: {
    saveEx: ["{name}: done! Keep it rolling.", "{name} is in the books.", "Boom. {name} logged."],
    pr: ["NEW RECORD on {name}! LET'S GO!", "{name}: personal best! You're getting stronger.", "Record smashed: {name}!"],
    cardio: ["Cardio done. Heart says thanks!", "Cardio crushed."],
    checkin: ["Check-in saved. Listen to that body!"],
    start: ["Clock's running. Let's get it!", "Workout started. Make it count!"],
    finish: ["WORKOUT COMPLETE!", "That's a wrap. Great work!"],
    badge: ["Badge unlocked: {name}!"],
    hi5sent: ["High-five sent to {name}!"],
    hi5got: ["{name} high-fived you!"],
    level: ["LEVEL UP! You're now {name}!"]
  },
  chill: {
    saveEx: ["Saved {name}.", "{name}, nice."],
    pr: ["Nice, that's a new best on {name}.", "New best on {name}."],
    cardio: ["Cardio saved."], checkin: ["Check-in saved."],
    start: ["Workout started."], finish: ["Workout done. Good session."],
    badge: ["New badge: {name}."], hi5sent: ["High-five sent to {name}."], hi5got: ["{name} sent a high-five."],
    level: ["You reached {name}."]
  },
  plain: {
    saveEx: ["Saved {name}."], pr: ["New best: {name}."], cardio: ["Saved cardio."], checkin: ["Saved check-in."],
    start: ["Started."], finish: ["Workout finished."], badge: ["Badge: {name}."], hi5sent: ["Sent."], hi5got: ["High-five from {name}."],
    level: ["Level: {name}."]
  }
};
export function say(voice, key, vars = {}) {
  const set = (LINES[voice] || LINES.chill)[key] || LINES.chill[key] || [""];
  const line = set[Math.floor(Math.random() * set.length)];
  return line.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

// ---------------------------------------------------------------- celebrations
export function confetti(colors) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("canvas"); c.className = "confetti"; document.body.appendChild(c);
  const dpr = devicePixelRatio || 1; c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  const x = c.getContext("2d"); x.scale(dpr, dpr);
  const bits = Array.from({ length: 110 }, () => ({
    x: innerWidth / 2 + (Math.random() - .5) * 80, y: innerHeight * .35, vx: (Math.random() - .5) * 11, vy: -Math.random() * 12 - 4,
    r: Math.random() * Math.PI, vr: (Math.random() - .5) * .3, w: 6 + Math.random() * 6, h: 4 + Math.random() * 4, c: colors[Math.floor(Math.random() * colors.length)]
  }));
  const start = performance.now();
  (function frame(t) {
    const age = t - start; x.clearRect(0, 0, innerWidth, innerHeight);
    for (const b of bits) { b.vy += .32; b.x += b.vx; b.y += b.vy; b.r += b.vr; x.save(); x.translate(b.x, b.y); x.rotate(b.r); x.globalAlpha = Math.max(0, 1 - age / 2200); x.fillStyle = b.c; x.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); x.restore(); }
    if (age < 2200) requestAnimationFrame(frame); else c.remove();
  })(start);
}
let audio;
export function unlockAudio() { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume?.(); } catch { /* no audio */ } return audio; }
export function fanfare() {
  const a = unlockAudio(); if (!a) return;
  [[523, 0], [659, .12], [784, .24], [1047, .38]].forEach(([f, off], i) => {
    const o = a.createOscillator(), g = a.createGain(); o.type = i === 3 ? "triangle" : "square"; o.frequency.value = f; o.connect(g); g.connect(a.destination);
    const t = a.currentTime + off, len = i === 3 ? .45 : .11;
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.12, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + len);
    o.start(t); o.stop(t + len + .05);
  });
}
export function chime() {
  const a = unlockAudio(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; o.connect(g); g.connect(a.destination);
  g.gain.setValueAtTime(.0001, a.currentTime); g.gain.exponentialRampToValueAtTime(.1, a.currentTime + .02); g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + .3);
  o.start(); o.stop(a.currentTime + .35);
}

// ---------------------------------------------------------------- numbers
export const volumeOf = e => (e.kind === "load" || e.kind === "carry") ? (e.sets || []).reduce((t, s) => t + (s.w || 0) * (e.kind === "carry" ? 1 : (s.r || 0)) * (e.db ? 2 : 1), 0) : 0;
const THINGS = [[70, "golden retriever"], [250, "refrigerator"], [900, "grand piano"], [1100, "horse"], [2600, "small car"], [5000, "pickup truck"], [12000, "elephant"], [25000, "school bus"]];
export function funWeight(lb) {
  if (lb < 70) return "";
  const [w, name] = THINGS.filter(([w]) => lb >= w).pop();
  const n = lb / w;
  return n < 1.15 ? `about one ${name}` : `about ${n < 10 ? n.toFixed(1).replace(/\.0$/, "") : Math.round(n)} ${name}s`;
}

const workoutDays = ss => [...new Set(ss.filter(s => (s.exercises || []).some(e => !e.skipped && e.sets?.length)).map(s => s.date))].sort();

// Weeks (by Monday) with at least `need` workout days, and streaks of them.
export function streaks(sessions, user, today, need = 3) {
  const days = workoutDays(S.userSessions(sessions, user));
  const perWeek = {}; for (const d of days) { const m = S.mondayOf(d); perWeek[m] = (perWeek[m] || 0) + 1; }
  const good = new Set(Object.keys(perWeek).filter(k => perWeek[k] >= need));
  const thisMon = S.mondayOf(today);
  let cur = 0, wk = good.has(thisMon) ? thisMon : S.addDays(thisMon, -7);
  while (good.has(wk)) { cur++; wk = S.addDays(wk, -7); }
  let longest = 0, run = 0, prev = null;
  for (const k of [...good].sort()) { run = prev && S.addDays(prev, 7) === k ? run + 1 : 1; longest = Math.max(longest, run); prev = k; }
  return { current: cur, longest, thisWeek: perWeek[thisMon] || 0, need, days: days.length };
}

// Every time a set beat the previous best for that exercise and version.
export function prEvents(sessions, user) {
  const best = new Map(), out = [];
  for (const s of S.userSessions(sessions, user)) for (const e of s.exercises || []) {
    if (e.skipped || !e.sets?.length) continue;
    const k = `${e.id}|${e.variant || "std"}`; const sc = S.bestScore(e.kind, e.sets);
    if (best.has(k) && S.betterThan(e.kind, sc, best.get(k))) out.push({ date: s.date, name: e.name, id: e.id });
    if (!best.has(k) || S.betterThan(e.kind, sc, best.get(k))) best.set(k, sc);
  }
  return out;
}

// ---------------------------------------------------------------- points & levels (Full fun level)
export const LEVELS = ["Rookie", "Regular", "Grinder", "Iron", "Steel", "Titan", "Beast", "Legend", "Mythic", "Immortal"];
export function points(sessions, activities, user, from, to) {
  let p = 0; const ss = S.userSessions(sessions, user).filter(s => (!from || s.date >= from) && (!to || s.date <= to));
  for (const s of ss) {
    p += (s.exercises || []).filter(e => !e.skipped && e.sets?.length).length * 10;
    if (s.cardio?.done) p += 15; if (s.checkin || s.pain) p += 5; if (s.warmup) p += 5; if (s.finishedAt) p += 20;
  }
  p += prEvents(sessions, user).filter(e => (!from || e.date >= from) && (!to || e.date <= to)).length * 25;
  p += activities.filter(a => a.user === user && a.type === "Bike commute" && (!from || a.date >= from) && (!to || a.date <= to)).length * 10;
  return p;
}
export function level(pts) {
  const i = Math.min(LEVELS.length - 1, Math.floor(pts / 500));
  return { i, name: LEVELS[i], into: pts - i * 500, next: i < LEVELS.length - 1 ? 500 : null };
}

// ---------------------------------------------------------------- badges
export const BADGES = [
  { id: "first", icon: "🏁", name: "First Rep", desc: "Logged your first workout." },
  { id: "w10", icon: "🔟", name: "Double Digits", desc: "10 workouts logged." },
  { id: "w25", icon: "🎯", name: "Quarter Century", desc: "25 workouts logged." },
  { id: "w50", icon: "🏆", name: "Fifty Strong", desc: "50 workouts logged." },
  { id: "pr1", icon: "⭐", name: "Personal Best", desc: "Beat one of your own records." },
  { id: "pr10", icon: "🌟", name: "Record Breaker", desc: "10 personal bests." },
  { id: "week4", icon: "📅", name: "Full Week", desc: "4 workouts in one week." },
  { id: "streak4", icon: "🔥", name: "On Fire", desc: "4 weeks in a row with 3+ workouts." },
  { id: "db50", icon: "💪", name: "Top of the Rack", desc: "Used 50 lb dumbbells." },
  { id: "ton", icon: "🏗️", name: "Heavy Lifting", desc: "10,000 lb moved in one workout." },
  { id: "cardio10", icon: "❤️", name: "Heart Work", desc: "10 cardio sessions." },
  { id: "hiit10", icon: "⚡", name: "Interval Hero", desc: "10 interval sessions." },
  { id: "commute100", icon: "🚲", name: "Century Rider", desc: "100 commute miles in a month." },
  { id: "painfree", icon: "🩹", name: "Feeling Good", desc: "A week of check-ins with no pain above 2." },
  { id: "waist1", icon: "📏", name: "Notch Down", desc: "Waist down 1 inch from your first measurement." },
  { id: "explorer", icon: "🧭", name: "Explorer", desc: "Tried 10 exercises from the library." },
  { id: "warm10", icon: "🌡️", name: "Warmed Up", desc: "Did 10 warm-ups." }
];
export function earnedBadges(sessions, body, activities, user, today) {
  const ss = S.userSessions(sessions, user); const days = workoutDays(ss); const got = new Set();
  if (days.length >= 1) got.add("first"); if (days.length >= 10) got.add("w10"); if (days.length >= 25) got.add("w25"); if (days.length >= 50) got.add("w50");
  const prs = prEvents(sessions, user).length; if (prs >= 1) got.add("pr1"); if (prs >= 10) got.add("pr10");
  const st = streaks(sessions, user, today); if (st.longest >= 4) got.add("streak4");
  const perWeek = {}; days.forEach(d => { const m = S.mondayOf(d); perWeek[m] = (perWeek[m] || 0) + 1; }); if (Object.values(perWeek).some(n => n >= 4)) got.add("week4");
  for (const s of ss) {
    const ex = (s.exercises || []).filter(e => !e.skipped);
    if (ex.some(e => e.db && e.sets?.some(x => (x.w || 0) >= 50))) got.add("db50");
    if (ex.reduce((t, e) => t + volumeOf(e), 0) >= 10000) got.add("ton");
  }
  if (ss.filter(s => s.cardio?.done).length >= 10) got.add("cardio10");
  if (ss.filter(s => s.cardio?.hiit).length >= 10) got.add("hiit10");
  if (ss.filter(s => s.warmup).length >= 10) got.add("warm10");
  const miles = {}; activities.filter(a => a.user === user && a.type === "Bike commute").forEach(a => { const m = a.date.slice(0, 7); miles[m] = (miles[m] || 0) + (+a.miles || 0); });
  if (Object.values(miles).some(m => m >= 100)) got.add("commute100");
  const pw = {}; ss.filter(s => s.pain).forEach(s => { const m = S.mondayOf(s.date); (pw[m] ||= []).push(Math.max(0, ...Object.values(s.pain).map(Number))); });
  if (Object.values(pw).some(v => v.length >= 3 && v.every(x => x <= 2))) got.add("painfree");
  const waist = body.filter(b => b.user === user && b.waist).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (waist.length > 1 && waist[0].waist - Math.min(...waist.map(b => +b.waist)) >= 1) got.add("waist1");
  if (new Set(ss.flatMap(s => (s.exercises || []).map(e => e.id)).filter(id => id.startsWith("lib-"))).size >= 10) got.add("explorer");
  return got;
}
