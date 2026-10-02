// Two-Week Split — app shell, views and events.
import { PROFILES as SEEDS, PLAN, STRETCH, CARDIO, DAYS, DAY_NAMES, ALL_EX, FOCUS, PAIN_AREAS, variantDef, exDef } from "./plan.js";
import * as F from "./fun.js";
import * as T from "./timer.js";
import * as A from "./a11y.js";
import { safetyFor } from "./safety.js";
import * as S from "./stats.js";
import { BUILTIN, GYM, EQUIP, PATTERN, JOINTS, POSITION, LEVEL, PLAN_PATTERN, STRETCH_BY_FOCUS, normalizeLib } from "./library.js";
import { connect, save, remove, patch, dropField, signOutAndClear, importAll, COLLECTIONS, watchAuth, signInGoogle, signInEmail, createEmailAccount, resetPassword, addGoogle, addPassword, currentInfo,
  getUserDoc, setUserDoc, createCrew, joinCrew, watchCrew, updateMember, removeMember, renameCrew, newInviteCode, readLegacy } from "./firebase.js";

// ---------------------------------------------------------------- helpers
const $ = (s, r = document) => r.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
};
const TODAY = () => S.ymd(new Date());
// ---------------------------------------------------------------- profiles (built-in Mat & Benny + anyone set up in the app)
const PROFILE_DEFAULTS = { focus: [], focusNote: "", defaultVariant: "std", pain: ["knees", "shoulders", "lowerBack"], commute: { enabled: false, miles: 0 }, start: {}, notes: [],
  cardio: "steady", theme: "bunny", accent: "", textSize: "m", avatar: "", voice: "hype", fun: "medium", sound: true, color: "#2f6b5e" };
const SEED_EXTRA = { mat: { cardio: "steady", color: "#2f6b5e", avatar: "🐺" }, benny: { cardio: "intervals", color: "#4b5d8a", avatar: "🦊" } };
let profMemo = { src: null, map: {} };
function P(id) {
  if (profMemo.src !== state.data.profiles) profMemo = { src: state.data.profiles, map: {} };
  if (profMemo.map[id]) return profMemo.map[id];
  const saved = state.data.profiles.find(p => p.id === id) || {};
  const p = { ...PROFILE_DEFAULTS, ...(SEEDS[id] || {}), ...(SEED_EXTRA[id] || {}), ...saved, id };
  if (!p.name) p.name = id;
  return (profMemo.map[id] = p);
}
const PROFILES = new Proxy({}, { get: (_, id) => P(id) });
// Mat and Benny are built in, but only show up in a crew that actually has their data (so new crews start empty).
let idsMemo = { refs: [], ids: [] };
function profileIds() {
  const d = state.data; const refs = [d.profiles, d.sessions, d.body, d.activities, state.auth?.members];
  if (refs.every((r, i) => r === idsMemo.refs[i])) return idsMemo.ids;
  const used = new Set([...d.sessions, ...d.body, ...d.activities].map(x => x.user).concat((state.auth?.members || []).map(m => m.profileId)));
  const ids = [...new Set([...Object.keys(SEEDS).filter(id => used.has(id)), ...d.profiles.map(p => p.id)])]
    .filter(id => !d.profiles.find(p => p.id === id && p.archived));
  idsMemo = { refs, ids };
  return ids;
}
const other = u => { const pid = state.partnerId && state.partnerId !== u ? state.partnerId : null; return pid || profileIds().find(id => id !== u) || u; };
S.setProfileSource(P);
const cardioProgram = u => CARDIO[P(u).cardio === "intervals" ? "benny" : "mat"];
const yt = q => "https://www.youtube.com/results?search_query=" + encodeURIComponent(q + " proper form") + A.ytParams();
const ytStretch = q => "https://www.youtube.com/results?search_query=" + encodeURIComponent(q + " stretch how to") + A.ytParams();
const DIFF = ["", "Easy", "Right", "Hard"];
const VARIANT_LABEL = { std: "Standard", hard: "Harder", swap: "Swap" };
const vLabel = v => (String(v).startsWith("lib:") ? "Library swap" : VARIANT_LABEL[v] || v);
const GROUPS = ["chest", "shoulders", "arms", "back", "core", "glutes", "legs", "calves", "cardio"];
const KIND_LABEL = { load: "Weight × reps", bw: "Reps only", time: "Time (seconds)", carry: "Weight × steps", assist: "Assist weight × reps" };
// Library = built-in list + what's saved in the database (same id: saved version wins; hidden: removed).
let libMemo = { src: null, list: [] };
function allLibrary() {
  if (libMemo.src === state.data.library) return libMemo.list;
  const saved = new Map(state.data.library.map(d => [d.id, d]));
  const out = [];
  for (const b of BUILTIN) { const o = saved.get(b.id); saved.delete(b.id); if (o?.hidden) continue; out.push(o ? { ...b, ...o, builtin: true, edited: true } : b); }
  for (const d of saved.values()) if (!d.hidden) out.push({ ...normalizeLib(d), builtin: false });
  libMemo = { src: state.data.library, list: out };
  return out;
}
const libItem = id => allLibrary().find(x => x.id === id);
const hiddenBuiltins = () => state.data.library.filter(d => d.hidden && BUILTIN.some(b => b.id === d.id));
const aches = u => state.data.settings.find(x => x.id === `aches_${u}`)?.areas || [];
// Which of a person's sore areas an exercise loads: high (2) or some (1).
function conflicts(m, u) {
  const a = aches(u); const j = m.joints || {};
  return { high: a.filter(x => j[x] === 2), some: a.filter(x => j[x] === 1) };
}
const dots = (n, max = 3) => "●".repeat(n) + "○".repeat(Math.max(0, max - n));
// A library entry dressed as a workout exercise.
function libEx(m) {
  return { id: `lib-${m.id}`, n: m.name, sr: m.sr || "3 × 10", tag: "lib", focus: m.focus || [], kind: m.kind || "load", db: !!m.db,
    why: m.how || m.notes || "", setup: m.how || m.notes || "", s: (STRETCH_BY_FOCUS[(m.focus || [])[0]] || []).slice(0, 2), swap: null,
    q: m.name, h: null, v: null, notes: {}, lib: m, custom: false };
}
function resolveEx(id, entry) {
  if (id.startsWith("lib-")) { const m = libItem(id.slice(4)); if (m) return libEx(m); }
  return exDef(id, entry);
}
// Per-person plan changes: settings doc plan_<user> = { days: { "A-Mon": { add: [ids], remove: [ids] } } }
const planEdits = u => state.data.settings.find(x => x.id === `plan_${u}`)?.days || {};
function editPlan(users, weeks, day, fn) {
  for (const u of users) {
    const days = JSON.parse(JSON.stringify(planEdits(u)));
    for (const w of weeks) { const k = `${w}-${day}`; days[k] = { add: [], remove: [], order: [], sr: {}, title: "", ...(days[k] || {}) }; fn(days[k]); }
    save("settings", `plan_${u}`, { days });
  }
}
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

let toastTimer;
// Messages stay up as long as the person chose in Accessibility (or until tapped).
function toast(msg) {
  let t = $(".toast");
  if (!t) { t = document.createElement("button"); t.type = "button"; t.className = "toast"; t.setAttribute("role", "status"); t.addEventListener("click", () => t.remove()); document.body.appendChild(t); }
  t.innerHTML = `${esc(msg)}<span class="toast-x" aria-hidden="true">✕</span><span class="visually-hidden">. Tap to dismiss.</span>`;
  const secs = A.get().toastTime;
  clearTimeout(toastTimer); if (secs) toastTimer = setTimeout(() => t.remove(), secs * 1000);
}

// ---------------------------------------------------------------- state
const state = {
  user: store.get("twp-user", null),
  partner: store.get("twp-partner", false),
  view: store.get("twp-view", "today"),
  logUser: null, logDate: null, viewUser: null, sel: null, userTouchedSel: false,
  variants: store.get("twp-variants", {}),
  editing: new Set(),
  data: { sessions: [], body: [], activities: [], settings: [], library: [], profiles: [], pings: [] }, libF: { q: "", equip: "all", focus: "all", pattern: "all", difficulty: "all", effort: "all", impact: "all", sort: "name", hideSore: "yes", ...store.get("twp-libf", {}) }, libEdit: null, libSwapFor: null, addPlan: null, planEdit: false,
  flags: {}, error: null, raw: {},
  progTab: "lifts", progEx: null, bodyField: "weight",
  repTab: "cycle", repCycle: null, cmpA: null, cmpB: null,
  confirmDel: null, timer: null, overlay: null, pickerQ: "",
  charts: []
};
state.partnerId = store.get("twp-partner-id", null);
if (!["today", "progress", "body", "report", "gym"].includes(state.view)) state.view = "today";
Object.keys(localStorage).filter(k => k.startsWith("twp-draft-")).forEach(k => store.del(k)); // old whole-workout drafts

const cycleStart = () => state.data.settings.find(s => s.id === "app")?.cycleStart || "2026-09-28";
const LU = () => state.logUser || state.user;
const LD = () => state.logDate || TODAY();

function autoSel() {
  const t = TODAY(); const dow = new Date().getDay();
  if (dow >= 1 && dow <= 4) return { week: S.cycleInfo(t, cycleStart()).week, day: DAYS[dow - 1] };
  const nextMon = S.addDays(t, dow === 0 ? 1 : 8 - dow);
  return { week: S.cycleInfo(nextMon, cycleStart()).week, day: "Mon" };
}
const variantOf = (u, ex) => state.variants[`${u}:${ex.id}`] || (P(u).defaultVariant === "hard" && ex.h ? "hard" : "std");

// ---------------------------------------------------------------- sessions: one document per person per day
const sid = (u, date) => `${u}_${date}`;
const sessionFor = (u, date) => state.data.sessions.find(s => s.id === sid(u, date)) || state.data.sessions.find(s => s.user === u && s.date === date) || null;

// Only the changed fields are sent, so a partner logging on another phone can't wipe out what you saved.
function writeSession(u, date, fields) {
  const cur = sessionFor(u, date);
  const ident = !cur || cur.id !== sid(u, date) ? { user: u, date, week: cur?.week || state.sel.week, day: cur?.day || state.sel.day } : {};
  patch("sessions", sid(u, date), { ...ident, ...fields });
}
// Exercises are stored as a map keyed by exercise id (ex.<id>); older records used an array. Readers get one sorted array.
function normalizeSession(s) {
  if (!s.ex) return s;
  const map = Object.fromEntries(Object.entries(s.ex).filter(([, v]) => v));
  const legacy = (s.exercises || []).filter(e => !map[e.id]);
  const all = [...legacy, ...Object.values(map)].sort((a, b) => (a.order ?? 500) - (b.order ?? 500));
  return { ...s, exercises: all };
}

// Tonight's first version saved a new document per save. Fold any duplicates into one per person per day.
let merging = false;
function consolidate() {
  if (merging || state.flags.sessions?.fromCache) return;
  const groups = {};
  for (const s of state.data.sessions) (groups[`${s.user}|${s.date}`] ||= []).push(s);
  for (const docs of Object.values(groups)) {
    const { user, date } = docs[0];
    if (docs.length === 1 && docs[0].id === sid(user, date)) continue;
    merging = true;
    docs.sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
    const ex = new Map();
    for (const d of docs) for (const e of d.exercises || []) if (!e.skipped && e.sets?.length) ex.set(`${e.id}|${e.variant || "std"}`, e);
    const latest = (f) => docs.map(d => d[f]).filter(v => v && (typeof v !== "object" || Object.keys(v).length)).pop();
    const cardio = docs.map(d => d.cardio).filter(c => c?.done).pop() || null;
    const notes = [...new Set(docs.map(d => d.notes).filter(Boolean))].join(" ");
    const exMap = {}; [...ex.values()].forEach((e, i) => { exMap[e.id] = { ...e, order: e.order ?? i }; });
    const merged = { user, date, week: docs[0].week, day: docs[0].day, exercises: [], ex: exMap, cardio, pain: latest("pain") || null, recovery: latest("recovery") || null, notes };
    if (merged.pain || merged.recovery || notes) merged.checkin = true;
    // Merge rather than overwrite, in case the other phone saved something to this day a moment ago.
    patch("sessions", sid(user, date), merged);
    for (const d of docs) if (d.id !== sid(user, date)) remove("sessions", d.id);
  }
  merging = false;
}

// ---------------------------------------------------------------- per-exercise drafts (kept on this phone until saved)
const dKey = (u, date, id) => `twp-x-${u}-${date}-${id}`;
const editKey = (u, date, id) => `${u}|${date}|${id}`;

function prefillSets(u, def, id, v, date = LD()) {
  const light = deloadActive(u, date) ? x => ({ ...x, sets: lightSets(x.sets, def.db) }) : x => x;
  const last = S.lastTime(state.data.sessions.filter(s => !deloadActive(u, s.date) || s.date === date), u, id, v);
  if (last && last.sets?.length) return light({ sets: last.sets.map(s => ({ w: s.w || 0, r: s.r || 0, d: 2 })), fresh: false });
  const { sets, min, max } = S.parseRange(def.sr || "3 × 10");
  const start = (P(u).start || {})[v === "std" ? id : `${id}:${v}`] ?? 0;
  const r = def.kind === "time" ? (min || 30) : (max || min || 10);
  return light({ sets: Array.from({ length: sets || 3 }, () => ({ w: start, r, d: 2 })), fresh: true });
}
function getDraft(u, date, ex, logged) {
  const k = dKey(u, date, ex.id); let d = store.get(k, null);
  if (d) return d;
  if (logged) return { variant: logged.variant || "std", sets: logged.sets.map(s => ({ ...s, done: true })), fresh: false };
  const v = ex.custom ? "std" : variantOf(u, ex);
  const def = defOf(ex, v);
  const p = prefillSets(u, { sr: srFor(u, ex, def), kind: def.kind, db: def.db }, ex.id, v, date);
  return { variant: v, ...p };
}
const putDraft = (u, date, id, d) => store.set(dKey(u, date, id), d);

// Extra exercises added for a day but not saved yet.
const xKey = (u, date) => `twp-extra-${u}-${date}`;
const getExtras = (u, date) => store.get(xKey(u, date), []);

function todaysList(u, date) {
  const { week, day } = state.sel;
  const s = sessionFor(u, date);
  const edits = dayEdits(u, week, day);
  const list = PLAN[week][day].ex.filter(ex => !edits.remove.includes(ex.id)).map(ex => ({ ex, added: false }));
  for (const id of edits.add) { const ex = resolveEx(id, {}); if (ex && !ex.custom) list.push({ ex, added: false, planned: true }); }
  if (edits.order?.length) list.sort((a, b) => { const ia = edits.order.indexOf(a.ex.id), ib = edits.order.indexOf(b.ex.id); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib); });
  const ids = new Set(list.map(x => x.ex.id));
  for (const e of s?.exercises || []) if (!ids.has(e.id)) { ids.add(e.id); list.push({ ex: resolveEx(e.id, e), added: true }); }
  for (const e of getExtras(u, date)) if (!ids.has(e.id)) { ids.add(e.id); list.push({ ex: resolveEx(e.id, e), added: true }); }
  return list;
}

// ---------------------------------------------------------------- render
function render() {
  const main = $("#main");
  destroyCharts();
  if (!state.auth?.ready || !state.auth.user || !state.auth.crewId) {
    applyAppearance(); $("#tabs").classList.add("hidden"); $("#who").classList.add("hidden"); $("#gear").classList.add("hidden"); $("#sync").classList.add("hidden");
    main.innerHTML = !state.auth?.ready ? `<p class="muted">Loading…</p>` : !state.auth.user ? viewSignIn() : viewCrewSetup();
    document.title = "Two-Week Split"; A.restoreFocus(main);
    return;
  }
  if (state.user && state.flags.profiles && !profileIds().includes(state.user)) state.user = null;
  applyAppearance();
  if (!state.user) {
    $("#tabs").classList.add("hidden"); $("#who").classList.add("hidden");
    main.innerHTML = `<section class="pick">${logoHtml("small")}<h2>Who's training?</h2>
      <div class="pick-people">${profileIds().map(id => `<button class="btn person" data-act="pickUser" data-u="${id}">${avatarHtml(id, true)}<span>${esc(P(id).name)}</span></button>`).join("")}</div>
      <button class="btn" data-act="newProfile">+ New person</button>
      ${isOwner() && !state.data.sessions.length ? `<button class="btn small" data-act="legacyQuick">Bring over data from the first version</button>` : ""}
      <p class="muted small">You can switch any time from the name button at the top.</p>
      <button class="btn small" data-act="openA11y"><span aria-hidden="true">♿</span> Accessibility options</button></section>`;
    return;
  }
  if (profileIds().length < 2) state.partner = false;
  if (!state.partner) state.logUser = state.user;
  $("#tabs").classList.remove("hidden"); $("#gear").classList.remove("hidden"); $("#sync").classList.remove("hidden");
  const who = $("#who"); who.classList.remove("hidden"); who.innerHTML = avatarHtml(state.user) + esc(P(state.user).name) + (state.partner ? " + " + esc(P(other(state.user)).name) : "");
  document.querySelectorAll("#tabs button").forEach(b => { if (b.dataset.view === state.view) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  if (!state.sel) {
    const s = sessionFor(LU(), LD());
    state.sel = s && s.week && s.day ? { week: s.week, day: s.day } : autoSel();
  }
  if (!state.viewUser || !profileIds().includes(state.viewUser)) state.viewUser = state.user;
  const banner = state.error ? `<div class="banner" role="alert">${esc(state.error)}</div>` : "";
  const views = { today: viewToday, progress: viewProgress, body: viewBody, report: viewReport, gym: viewGym };
  main.innerHTML = banner + views[state.view]();
  afterRender();
  document.title = `${VIEW_NAMES[state.view] || ""} · Two-Week Split`;
  A.restoreFocus(main);
}
const VIEW_NAMES = { today: "Workout", progress: "Progress", body: "Body", report: "Report", gym: "Gym" };

function personToggle(act = "viewUser", cur = state.viewUser) {
  return `<div class="seg" role="group" aria-label="Person">${profileIds().map(u => `<button data-act="${act}" data-u="${u}" aria-pressed="${cur === u}">${avatarHtml(u)}${esc(P(u).name)}</button>`).join("")}</div>`;
}
function seg(act, current, opts, label, extra = "") {
  return `<div class="seg" role="group" aria-label="${esc(label || act)}">${opts.map(([v, l]) => `<button data-act="${act}" data-v="${v}" ${extra} aria-pressed="${current === v}">${esc(l)}</button>`).join("")}</div>`;
}

// ---------------------------------------------------------------- TODAY (plan + logging in one place)
function viewToday() {
  const u = LU(), p = P(u), date = LD();
  const { week, day } = state.sel;
  const ci = S.cycleInfo(TODAY(), cycleStart());
  const s = sessionFor(u, date);
  const list = todaysList(u, date);
  const done = list.filter(x => s?.exercises?.some(e => e.id === x.ex.id)).length;
  const notToday = date !== TODAY();
  const rem = notToday ? [] : reminders(u);
  const dl = deloadActive(u, date); const dlSug = notToday ? null : deloadSuggestion(u);
  const partner = other(u);
  return `
  ${state.partner ? `<section class="card"><span class="eyebrow">Partner mode · logging for</span>${personToggle("logUser", u)}</section>` : ""}
  ${notToday ? `<div class="banner">Showing ${S.fmtDate(date)}. <button class="btn small" data-act="backToToday">Back to today</button></div>` : ""}
  ${rem.length && !focusOn() ? `<section class="reminders" aria-label="Reminders">${rem.map(r => `<div class="rem"><span>${esc(r.text)}</span><span class="row"><button class="btn small" data-act="goView" data-v="${r.view}">Open</button><button class="btn small" data-act="dismissRem" data-v="${r.id}" aria-label="Remind me tomorrow">✕</button></span></div>`).join("")}</section>` : ""}
  ${dl ? `<div class="banner"><b>Lighter week</b> until ${S.fmtDate(deloadOf(u).to)}: about 60% of your usual weights and one less set. <button class="btn small" data-act="endDeload">End it early</button></div>` : dlSug ? `<div class="banner">${esc(dlSug)} <button class="btn small" data-act="startDeload">Start a lighter week</button></div>` : ""}
  <section class="card">
    <div class="between"><span class="eyebrow">${ci.week === week && !notToday ? "This week is" : "Viewing"} Week ${week}</span>${funAt("medium") ? "" : `<span class="small muted mono">${done}/${list.length} done</span>`}</div>
    ${seg("selWeek", week, [["A", "Week A"], ["B", "Week B"]], "Week")}
    <div class="chips" role="group" aria-label="Day">${DAYS.map(d => `<button data-act="selDay" data-v="${d}" aria-pressed="${d === day}">${d}<small>${esc(dayTitle(u, week, d).split(",")[0])}</small></button>`).join("")}</div>
    <div class="ring-row">${funAt("medium") ? ring(done, list.length) + `<span class="visually-hidden">${done} of ${list.length} exercises done.</span>` : ""}<div style="min-width:0;flex:1"><h2 class="h2">${DAY_NAMES[day]} · ${esc(dayTitle(u, week, day))}</h2>${funHeader(u)}</div></div>
    ${workoutBar(u, date, s)}
    <details class="more"><summary>${esc(p.name)}'s focus, notes and date</summary><div class="panel"><p>${esc(p.focusNote)}</p><ul class="small">${(p.notes || []).map(n => `<li>${esc(n)}</li>`).join("")}</ul>
      <label class="field">Logging date<input type="date" data-act="logDate" value="${date}"></label></div></details>
    <div class="row"><button class="btn small" data-act="planEdit" aria-pressed="${!!state.planEdit}">${state.planEdit ? "Done editing plan" : "Edit this day's plan"}</button>
      ${funAt("medium") && partner !== u ? `<button class="btn small" data-act="hi5">🙌 High-five ${esc(P(partner).name)}</button>` : ""}</div>
    ${state.planEdit ? planEditBox(u, week, day) : ""}
  </section>
  ${focusOn() ? focusSteps(u, date, s, list) : `
  ${A.get().focusMode && state.focusAll ? `<button class="btn block" data-act="focusBack">Back to one step at a time</button>` : ""}
  ${warmupCard(u, date, s, list)}
  ${cardioCard(u, date, s)}
  ${supersetIdeas(u, date, list, s)}
  ${list.map(({ ex, added }, i) => exerciseCard(u, date, ex, added, s, i, list.length)).join("")}
  <button class="btn block add-ex" data-act="openPicker">+ Add an exercise</button>
  ${checkinCard(u, date, s)}`}
  ${s?.startedAt && !s.finishedAt ? `<button class="btn primary block" data-act="finishWorkout">Finish workout</button>` : ""}`;
}

// Focus mode: one step on screen at a time, with Back / Next. Saving a step moves on to the next unfinished one.
const focusSaved = () => { if (focusOn()) { state.focusAfter = state.focusIdx ?? -1; state.focusStep = null; } };
const focusOn = () => A.get().focusMode && !state.focusAll && !state.planEdit;
function focusSteps(u, date, s, list) {
  const steps = [
    { name: "Warm-up", done: !!s?.warmup, html: () => warmupCard(u, date, s, list) },
    { name: "Cardio", done: !!(s?.cardio?.done || s?.cardio?.skipped), html: () => cardioCard(u, date, s) },
    ...list.map(({ ex, added }, i) => ({ name: defOf(ex, variantOf(u, ex)).name, done: !!s?.exercises?.some(e => e.id === ex.id), html: () => exerciseCard(u, date, ex, added, s, i, list.length) })),
    { name: "Check-in", done: !!s?.checkin, html: () => checkinCard(u, date, s) }
  ];
  // After saving a step, go to the next unfinished step after it (then wrap around to any skipped ones).
  const after = state.focusAfter ?? -1;
  const nextUp = steps.findIndex((x, j) => j > after && !x.done);
  const auto = nextUp >= 0 ? nextUp : Math.max(0, steps.findIndex(x => !x.done));
  let i = state.focusStep ?? auto; if (i >= steps.length) i = steps.length - 1;
  if (state.focusStep == null && state.focusAfter != null) { state.focusStep = i; state.focusAfter = null; }
  state.focusIdx = i; state.focusCount = steps.length;
  const left = steps.filter(x => !x.done).length;
  return `<section class="card focus-head" aria-label="One step at a time">
      <div class="between"><span class="eyebrow">Step ${i + 1} of ${steps.length}</span><button class="btn small" data-act="focusAll">Show everything</button></div>
      <ol class="focus-steps">${steps.map((x, j) => `<li class="${x.done ? "done" : ""} ${j === i ? "now" : ""}"><button type="button" data-act="focusGo" data-n="${j}" aria-current="${j === i ? "step" : "false"}" aria-label="${esc(x.name)}${x.done ? ", done" : ""}">${x.done ? "✓" : j + 1}</button></li>`).join("")}</ol>
      <p class="small muted">${left ? `${left} step${left === 1 ? "" : "s"} left today.` : "Everything's done today."}</p>
    </section>
    ${steps[i].html()}
    <div class="focus-nav"><button class="btn" data-act="focusGo" data-n="${i - 1}" ${i === 0 ? "disabled" : ""}>← Back</button><button class="btn primary" data-act="focusGo" data-n="${i + 1}" ${i >= steps.length - 1 ? "disabled" : ""}>Next →</button></div>
    ${i >= 2 && i < steps.length - 1 ? `<button class="btn block add-ex" data-act="openPicker">+ Add an exercise</button>` : ""}`;
}
function exerciseCard(u, date, ex, added, s, idx = 0, count = 0) {
  const logged = s?.exercises?.find(e => e.id === ex.id);
  const ek = editKey(u, date, ex.id);
  if (logged && !state.editing.has(ek)) {
    const def = S.defFor(ex.id, logged.variant || "std", logged);
    return `<article class="card ex done-card" id="ex-${ex.id}">
      <div class="head"><h3 class="name"><span class="tick" aria-hidden="true">✓</span><span class="visually-hidden">Done: </span>${esc(logged.name || def.name)}${logged.variant && logged.variant !== "std" ? `<span class="tag new">${vLabel(logged.variant)}</span>` : ""}${added ? `<span class="tag orig">Added</span>` : ""}</h3><button class="btn small" data-act="editEx" data-ex="${ex.id}">Log</button></div>
      <div class="last"><b>${esc(S.setsText(logged))}</b></div>
    </article>`;
  }
  const d = getDraft(u, date, ex, logged);
  const v = d.variant;
  const lib = String(v).startsWith("lib:") ? libItem(v.slice(4)) : null;
  const def = defOf(ex, v);
  const opts = [["std", "Standard"]]; if (ex.h) opts.push(["hard", "Harder"]); if (ex.swap) opts.push(["swap", "Swap"]);
  if (!ex.custom) opts.push(["lib", "Library"]);
  const why = lib ? (lib.how || lib.notes || `From your gym library. Same target: ${ex.sr}.`) : v === "hard" && ex.h ? ex.h.how : v === "swap" && ex.swap ? ex.swap.how : ex.why;
  const last = S.lastTime(state.data.sessions, u, ex.id, v);
  const sug = ex.custom ? null : S.suggestion(state.data.sessions, u, ex.id, v);
  const pu = other(u), pLast = state.partner ? S.lastTime(state.data.sessions, pu, ex.id, ex.custom ? "std" : variantOf(pu, ex)) : null;
  const entry = { kind: def.kind, db: def.db };
  const target = srFor(u, ex, def);
  const safety = lib || ex.lib || safetyFor(ex, v);
  const sore = safety ? conflicts(safety, u) : { high: [], some: [] };
  const smith = /smith/i.test(def.name) ? (gymSet().smithBar ? `Smith bar: ${gymSet().smithBar} lb. Log it the same way every time (with or without the bar).` : "Smith bar weight isn't set yet. Add it in Settings → Our gym once you check.") : "";
  return `<article class="card ex" id="ex-${ex.id}" data-ex="${ex.id}">
    <div class="head"><h3 class="name">${esc(def.name)}${ex.custom || lib ? "" : ex.lib ? `<span class="tag orig">Library</span>` : `<span class="tag ${ex.tag}">${ex.tag === "orig" ? "Original" : "New"}</span>`}${added ? `<span class="tag orig">Added</span>` : ""}</h3><span class="sr">${esc(target || "")}</span></div>
    ${sore.high.length ? `<div class="pill hold">Hard on your ${esc(sore.high.map(j => (JOINTS[j] || j).toLowerCase()).join(" and "))} today. Consider a swap.</div>` : sore.some.length ? `<div class="small warn-text">Some load on your ${esc(sore.some.map(j => (JOINTS[j] || j).toLowerCase()).join(" and "))} today.</div>` : ""}
    ${opts.length > 1 ? seg("variant", String(v).startsWith("lib:") ? "lib" : v, opts, "Version") : ""}
    ${why ? `<div class="why">${esc(why)}</div>` : ""}
    ${lib ? `<div class="row"><a class="video" href="${yt(lib.name)}" target="_blank" rel="noopener">Watch form videos</a><button class="btn small" data-act="libSwap">Change machine</button></div>` : ""}
    ${ex.notes?.[u] ? `<div class="note">${esc(ex.notes[u])}</div>` : ""}
    ${smith ? `<div class="small muted">${esc(smith)}</div>` : ""}
    <div class="last">${last ? `Last time (${S.fmtDate(last.date)}): <b>${esc(S.describeSets(last.kind, last.db, last.sets))}</b>` : "No history yet for this version."}</div>
    ${state.partner ? `<div class="last">${PROFILES[pu].name}: ${pLast ? `<b>${esc(S.describeSets(pLast.kind, pLast.db, pLast.sets))}</b>` : "no history yet"}</div>` : ""}
    ${sug ? `<div class="pill ${sug.type}">${esc(sug.text)}</div>` : ""}
    ${d.fresh ? `<div class="pill hold fresh-note">First time: set the weight and reps you actually did.</div>` : ""}
    <div class="sets">${d.sets.map((x, i) => setRow(entry, x, i)).join("")}</div>
    ${def.kind === "time" ? setTimer(u, date, ex.id, d.sets) : ""}
    <div class="row"><button class="btn small" data-act="addSet">+ Add set</button><button class="btn small" data-act="timer">Rest timer</button>${A.get().readAloud && A.canSpeak() ? `<button class="btn small" data-act="readEx" aria-label="Read ${esc(def.name)} aloud">🔊 Read aloud</button>` : ""}
      ${logged ? `<button class="btn small" data-act="cancelEdit">Cancel</button><button class="btn small danger" data-act="deleteEx">${state.confirmDel === ek ? "Confirm delete" : "Delete"}</button>` : added ? `<button class="btn small danger" data-act="dropExtra">Remove</button>` : ""}</div>
    <button class="btn primary block ${d.sets.length && d.sets.every(x => x.done) ? "ready" : ""}" data-act="saveEx">${logged ? "Save changes" : "Save exercise"}</button>
    ${state.planEdit && !added ? `<div class="plan-tools"><span class="small muted">Plan for Week ${state.sel.week} ${state.sel.day}</span>
      <div class="row"><button class="btn small" data-act="planMove" data-v="-1" ${idx === 0 ? "disabled" : ""} aria-label="Move up">↑</button><button class="btn small" data-act="planMove" data-v="1" ${idx >= count - 1 ? "disabled" : ""} aria-label="Move down">↓</button>
      <label class="field" style="flex:1;min-width:120px">Target<input type="text" data-act="planSr" value="${esc(target)}"></label>
      <button class="btn small danger" data-act="planRemove">Remove</button></div></div>` : ""}
    ${ex.custom ? "" : `<details class="more"><summary>Form, video, risks &amp; stretches</summary>${exPanel(ex, safety)}</details>`}
  </article>`;
}

function exPanel(ex, safety) {
  return `<div class="panel">
    <div><h4>How to do it · ${esc(ex.n)}</h4><p>${esc(ex.setup)}</p><a class="video" href="${yt(ex.q)}" target="_blank" rel="noopener">Watch form videos</a></div>
    ${safety ? riskBlock(safety) : ""}
    ${ex.h ? `<div><h4>Harder · ${esc(ex.h.n)} · ${esc(ex.h.sr)}</h4><p>${esc(ex.h.how)}</p><a class="video" href="${yt(ex.h.q)}" target="_blank" rel="noopener">Watch form videos</a></div>` : ""}
    ${ex.swap ? `<div><h4>Swap · ${esc(ex.swap.n)}${ex.swap.sr ? ` · ${esc(ex.swap.sr)}` : ""}</h4><p>${esc(ex.swap.how)}</p><a class="video" href="${yt(ex.swap.q)}" target="_blank" rel="noopener">Watch form videos</a></div>` : ""}
    ${ex.v ? `<div><h4>More lunge types to rotate in</h4><div class="panel">${ex.v.map(x => `<div class="stretch"><b>${esc(x.n)}</b><p>${esc(x.h)}</p><a href="${yt(x.q)}" target="_blank" rel="noopener">Video</a></div>`).join("")}</div></div>` : ""}
    <div><h4>Between sets, while your partner's up</h4><div class="panel">${ex.s.map(stretchBox).join("")}</div></div>
  </div>`;
}
function stretchBox(k) {
  const s = STRETCH[k];
  const each = /per side/.test(s.t) ? "Hold · each side" : /each way/.test(s.t) ? "Hold · each way" : "Hold";
  return `<div class="stretch"><b>${esc(s.n)}<span>${esc(s.t)}</span></b><p>${esc(s.h)}</p>
    ${s.f ? `<dl class="stretch-notes"><dt>Feel it</dt><dd>${esc(s.f)}</dd><dt>What it does</dt><dd>${esc(s.g)}</dd></dl>` : ""}
    ${s.sec ? T.html(`st:${k}`, s.sec, each) : ""}
    <div class="row"><a href="${ytStretch(s.n)}" target="_blank" rel="noopener">See it done</a>${A.get().readAloud && A.canSpeak() ? `<button type="button" class="btn small" data-act="readStretch" data-v="${k}" aria-label="Read ${esc(s.n)} aloud">🔊 Read aloud</button>` : ""}</div></div>`;
}
// Timed exercises (planks, holds, jump rope): the timer runs the next set that isn't checked off, and checks it when time's up.
function setTimer(u, date, id, sets) {
  const si = sets.findIndex(x => !x.done);
  if (si < 0) return `<div class="tmr-note small muted">All sets checked off. Save it when you're ready.</div>`;
  const sec = +sets[si].r || 30;
  return T.html(`set:${u}|${date}|${id}|${si}`, sec, `Set ${si + 1} of ${sets.length}`, `.set[data-s="${si}"] input[data-f="r"]`);
}
function setRow(e, s, si) {
  const u = S.unitLabel(e.kind, e.db);
  const rStep = e.kind === "time" || e.kind === "carry" ? 5 : 1;
  return `<div class="set ${u.w ? "" : "noweight"} ${s.done ? "is-done" : ""}" data-s="${si}">
    <button type="button" class="n setcheck" role="checkbox" aria-checked="${!!s.done}" data-act="setDone" aria-label="Set ${si + 1} done">${s.done ? "✓" : si + 1}</button>
    ${u.w ? stepper("w", s.w, u.w, 1, `Set ${si + 1} weight`) : ""}
    ${stepper("r", s.r, u.r, rStep, `Set ${si + 1} ${u.r === "sec" ? "seconds" : u.r}`)}
    <div class="diff" role="group" aria-label="How set ${si + 1} felt">${[1, 2, 3].map(d => `<button type="button" data-act="diff" data-d="${d}" aria-pressed="${(s.d || 2) === d}">${DIFF[d]}</button>`).join("")}<button type="button" class="del" data-act="delSet" aria-label="Remove set ${si + 1}">×</button></div>
  </div>`;
}
function stepper(f, val, label, step, name = label) {
  const unit = label === "lb each" ? "pounds each" : label === "lb" ? "pounds" : label === "lb assist" ? "pounds of assist" : label === "sec" ? "seconds" : label;
  return `<div><div class="stepper"><button type="button" data-act="step" data-f="${f}" data-by="${-step}" aria-label="${esc(name)} down">−</button><input type="number" inputmode="decimal" step="any" data-f="${f}" value="${esc(val)}" aria-label="${esc(name)}, ${esc(unit)}"><button type="button" data-act="step" data-f="${f}" data-by="${step}" aria-label="${esc(name)} up">+</button></div><div class="stepper-label" aria-hidden="true">${esc(label)}</div></div>`;
}

// Cardio: its own save.
function cardioCard(u, date, s) {
  const { week, day } = state.sel; const cp = cardioProgram(u).plan(week, day);
  const ek = editKey(u, date, "cardio");
  const commute = state.data.activities.find(a => a.id === `${u}-${date}-commute`);
  if ((s?.cardio?.done || s?.cardio?.skipped) && !state.editing.has(ek)) {
    const c = s.cardio;
    return `<section class="card cardio-card done-card"><div class="head"><h3 class="name"><span class="tick" aria-hidden="true">✓</span><span class="visually-hidden">Done: </span>Cardio</h3><button class="btn small" data-act="editCardio">Log</button></div>
      <div class="last"><b>${c.skipped ? "Skipped: biked to work" : `${esc(c.type)}, ${c.minutes || 0} min${c.miles ? `, ${c.miles} mi` : ""}${c.avgHr ? `, avg HR ${c.avgHr}` : ""}${c.hiit ? ", intervals" : ""}`}</b>${commute ? ` · Bike commute ${commute.miles} mi` : ""}</div></section>`;
  }
  const c = store.get(`twp-c-${u}-${date}`, null) || { type: s?.cardio?.type || cp.type, minutes: s?.cardio?.minutes ?? 25, miles: s?.cardio?.miles ?? "", avgHr: s?.cardio?.avgHr ?? "", hiit: s?.cardio?.hiit ?? !!cp.hiit, commute: !!commute, commuteMiles: commute?.miles ?? PROFILES[u].commute.miles };
  const partner = state.partner ? cardioProgram(other(u)).plan(week, day) : null;
  return `<section class="card cardio-card" id="cardio-form">
    <div class="between"><h3 class="h3">Cardio · ${esc(cp.type)}</h3>${cp.hiit ? `<span class="tag new">Intervals</span>` : ""}</div>
    <p>${esc(cp.text)}</p>
    ${partner ? `<p class="small muted"><b>${PROFILES[other(u)].name}:</b> ${esc(partner.type)}. ${esc(partner.text)}</p>` : ""}
    <details class="more" ${state.editing.has(ek) ? "open" : ""}><summary>Log cardio</summary><div class="panel">
      <div class="grid2">
        <label class="field">Machine<select data-cf="type">${cardioProgram(u).options.map(o => `<option ${o === c.type ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></label>
        <label class="field">Minutes<input type="number" inputmode="numeric" data-cf="minutes" value="${esc(c.minutes)}"></label>
        <label class="field">Distance (miles)<input type="number" inputmode="decimal" step="any" data-cf="miles" value="${esc(c.miles)}" placeholder="optional"></label>
        <label class="field">Average heart rate<input type="number" inputmode="numeric" data-cf="avgHr" value="${esc(c.avgHr)}" placeholder="optional"></label>
      </div>
      <label class="check"><input type="checkbox" data-cf="hiit" ${c.hiit ? "checked" : ""}><span>Intervals (HIIT)</span></label>
      ${PROFILES[u].commute.enabled ? `<label class="check"><input type="checkbox" data-cf="commute" ${c.commute ? "checked" : ""}><span>I biked to work today</span></label>
        <label class="field">Round-trip commute miles<input type="number" inputmode="decimal" step="any" data-cf="commuteMiles" value="${esc(c.commuteMiles)}"></label>` : ""}
      <button class="btn primary block" data-act="saveCardio">Save cardio</button>
      ${PROFILES[u].commute.enabled ? `<button class="btn block" data-act="skipCardio">Biked to work, skipping gym cardio</button>` : ""}
    </div></details>
  </section>`;
}

// Pain, sleep, energy, soreness, notes: its own save, any time.
function checkinCard(u, date, s) {
  const ek = editKey(u, date, "checkin");
  const saved = s && (s.checkin || s.pain);
  if (saved && !state.editing.has(ek)) {
    const pain = PROFILES[u].pain.map(a => `${PAIN_AREAS[a]} ${s.pain?.[a] ?? 0}`).join(" · ");
    const r = s.recovery || {};
    return `<section class="card done-card"><div class="head"><h3 class="name"><span class="tick" aria-hidden="true">✓</span><span class="visually-hidden">Done: </span>Check-in</h3><button class="btn small" data-act="editCheckin">Log</button></div>
      <div class="last">Pain: ${esc(pain)}</div><div class="last">Sleep ${r.sleep || "–"} · Energy ${r.energy || "–"} · Soreness ${r.soreness || "–"}</div>${s.notes ? `<div class="last">${esc(s.notes)}</div>` : ""}</section>`;
  }
  const k = store.get(`twp-k-${u}-${date}`, null) || { pain: { ...Object.fromEntries(PROFILES[u].pain.map(a => [a, 0])), ...(s?.pain || {}) }, recovery: { sleep: 0, energy: 0, soreness: 0, ...(s?.recovery || {}) }, notes: s?.notes || "" };
  const row = (key, l, lo, hi) => `<div class="field"><span>${l} <span class="small">(1 ${lo} · 5 ${hi})</span></span><div class="scale" role="group" aria-label="${l}">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-act="scale" data-k="${key}" data-n="${n}" aria-pressed="${+k.recovery[key] === n}">${n}</button>`).join("")}</div></div>`;
  return `<section class="card" id="checkin-form"><h3 class="h3">Check-in: pain &amp; how you feel</h3>
    <p class="small muted">0 is nothing, 10 is stop-everything. Log zeros too, so healing shows on the chart.</p>
    ${PROFILES[u].pain.map(a => `<div class="pain-row"><span>${PAIN_AREAS[a]}</span><input type="range" min="0" max="10" step="1" data-kf="pain.${a}" value="${+k.pain[a] || 0}" aria-label="${PAIN_AREAS[a]} pain"><span class="mono" data-out="pain.${a}">${+k.pain[a] || 0}</span></div>`).join("")}
    ${row("sleep", "Sleep last night", "awful", "great")}${row("energy", "Energy", "drained", "strong")}${row("soreness", "Soreness", "none", "very")}
    <label class="field">Notes<textarea data-kf="notes" placeholder="Anything worth remembering: new machine, felt off, a win.">${esc(k.notes)}</textarea></label>
    <button class="btn primary block" data-act="saveCheckin">Save check-in</button>
  </section>`;
}

// ---------------------------------------------------------------- add-an-exercise picker
function openPicker() { state.overlay = "picker"; state.pickerQ = ""; drawPicker(); }
function drawPicker() {
  const u = LU(), date = LD(); const q = state.pickerQ.toLowerCase();
  const onList = new Set(todaysList(u, date).map(x => x.ex.id));
  const customs = new Map();
  for (const s of state.data.sessions) for (const e of s.exercises || []) if (e.id.startsWith("custom-")) customs.set(e.id, e);
  const match = n => !q || n.toLowerCase().includes(q);
  const item = (id, name, meta) => `<button class="list-btn" data-act="pickEx" data-id="${id}"><b>${esc(name)}</b><span class="small muted">${esc(meta)}</span></button>`;
  const libList = allLibrary().filter(m => !onList.has(`lib-${m.id}`) && match(m.name)).sort((a, b) => a.name.localeCompare(b.name)).map(m => `<button class="list-btn" data-act="pickLib" data-id="${esc(m.id)}"><b>${esc(m.name)}</b><span class="small muted">${esc([EQUIP[m.equip], (m.focus || []).map(f => FOCUS[f]).join(", ")].filter(Boolean).join(" · "))}</span></button>`).join("");
  const cust = [...customs.values()].filter(e => !onList.has(e.id) && match(e.name)).map(e => item(e.id, e.name, "Your exercise")).join("");
  const plan = Object.values(ALL_EX).filter(e => !onList.has(e.id) && match(e.n)).map(e => item(e.id, e.n, `Week ${e.week} ${e.day} · ${e.sr}`)).join("");
  $("#overlay").innerHTML = `<div class="overlay" role="dialog" aria-label="Add an exercise"><div class="inner">
    <div class="between"><h2 class="h2">Add an exercise</h2><button class="btn small" data-act="closeOverlay">Close</button></div>
    <label class="field">Search<input type="text" id="picker-q" data-act="pickerQ" value="${esc(state.pickerQ)}" placeholder="Hip adductor, row, curl…" autocomplete="off"></label>
    <section class="card"><h3 class="h3">Something new</h3>
      <label class="field">Name<input type="text" id="cx-name" placeholder="Hip Adductor Machine"></label>
      <div class="grid2"><label class="field">What you track<select id="cx-kind"><option value="load">Weight × reps</option><option value="bw">Reps only</option><option value="time">Time (seconds)</option><option value="carry">Weight × steps</option><option value="assist">Assist weight × reps</option></select></label>
      <label class="check" style="align-self:end"><input type="checkbox" id="cx-db"><span>Dumbbells (weight per hand)</span></label></div>
      <div class="field"><span>What it works (so it shows up as a swap)</span><div class="focus-chips" id="cx-focus">${GROUPS.map(g => `<button type="button" data-act="libFocus" data-v="${g}" aria-pressed="false">${FOCUS[g]}</button>`).join("")}</div></div>
      <label class="check"><input type="checkbox" id="cx-lib" checked><span>Save it to our gym library too</span></label>
      <button class="btn primary" data-act="addCustom">Add to today</button></section>
    ${libList ? `<section class="card"><h3 class="h3">From the gym library</h3><div class="pick-list">${libList}</div></section>` : ""}
    ${cust ? `<section class="card"><h3 class="h3">Ones you've added before</h3><div class="pick-list">${cust}</div></section>` : ""}
    <section class="card"><h3 class="h3">From the plan</h3><div class="pick-list">${plan || `<p class="muted small">No matches.</p>`}</div></section>
  </div></div>`;
}
function addExtra(entry) {
  const u = LU(), date = LD(); const xs = getExtras(u, date);
  if (!xs.find(x => x.id === entry.id)) xs.push(entry);
  store.set(xKey(u, date), xs); closeOverlay(); render();
  setTimeout(() => document.getElementById(`ex-${entry.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
}

// ---------------------------------------------------------------- definitions incl. library swaps
function defOf(ex, v) {
  if (ex.lib && !String(v).startsWith("lib:")) return { name: ex.n, sr: ex.sr, kind: ex.kind, db: ex.db, focus: ex.focus, q: ex.q };
  if (ex.custom) return { name: ex.n, sr: ex.sr, kind: ex.kind, db: ex.db, focus: ex.focus?.length ? ex.focus : undefined };
  if (String(v).startsWith("lib:")) {
    const m = libItem(v.slice(4));
    return { name: m?.name || "Library exercise", sr: ex.sr, kind: m?.kind || ex.kind, db: !!m?.db, q: m?.name || ex.q, focus: m?.focus };
  }
  return variantDef(ex, v);
}
function guessEquip(n) {
  const s = n.toLowerCase();
  if (/smith|barbell/.test(s)) return "barbell";
  if (/cable|rope|pulley|face pull|pallof|woodchop|pulldown/.test(s)) return "cable";
  if (/dumbbell|goblet|farmer|suitcase/.test(s)) return "dumbbell";
  if (/machine|press|curl|extension|abductor|adductor|row|leg press|pec|deck|captain/.test(s)) return "machine";
  if (/treadmill|bike|elliptical|rower|stair/.test(s)) return "cardio";
  return "bodyweight";
}

// ---------------------------------------------------------------- library swap picker
function openLibSwap(id) { state.overlay = "libswap"; state.libSwapFor = { u: LU(), date: LD(), id }; state.libSwapAll = false; drawLibSwap(); }
function drawLibSwap() {
  const { u, date, id } = state.libSwapFor; const ex = todaysList(u, date).find(x => x.ex.id === id)?.ex; if (!ex) return;
  const pattern = PLAN_PATTERN[ex.id] || ex.lib?.pattern || "";
  const scored = allLibrary().filter(m => `lib-${m.id}` !== ex.id).map(m => {
    const overlap = (m.focus || []).filter(f => ex.focus.includes(f)).length;
    return { m, score: (pattern && m.pattern === pattern ? 3 : 0) + overlap * 2 + ((m.focus2 || []).some(f => ex.focus.includes(f)) ? 1 : 0), same: pattern && m.pattern === pattern, overlap };
  }).filter(x => x.overlap > 0 || x.same).sort((a, b) => b.score - a.score || a.m.name.localeCompare(b.m.name));
  const ok = scored.filter(x => !conflicts(x.m, u).high.length);
  const sore = scored.filter(x => conflicts(x.m, u).high.length);
  const btn = ({ m, same }) => {
    const c = conflicts(m, u);
    return `<button class="list-btn" data-act="pickLibSwap" data-id="${esc(m.id)}"><b>${esc(m.name)}</b>
      <span class="small muted">${esc([EQUIP[m.equip], (m.focus || []).map(f => FOCUS[f]).join(", "), same ? `same movement (${PATTERN[m.pattern]})` : ""].filter(Boolean).join(" · "))}</span>
      <span class="small muted">Difficulty ${dots(m.difficulty)} · Effort ${dots(m.effort)} · Impact ${LEVEL.impact[m.impact || 0]}</span>
      ${c.high.length ? `<span class="small bad">Hard on your ${esc(c.high.map(j => JOINTS[j].toLowerCase()).join(" and "))}</span>` : c.some.length ? `<span class="small warn-text">Some load on your ${esc(c.some.map(j => JOINTS[j].toLowerCase()).join(" and "))}</span>` : ""}</button>`;
  };
  $("#overlay").innerHTML = `<div class="overlay" role="dialog" aria-label="Swap from library"><div class="inner">
    <div class="between"><h2 class="h2">Swap from library</h2><button class="btn small" data-act="closeOverlay">Close</button></div>
    <p class="muted">Instead of <b>${esc(ex.n)}</b>${pattern ? ` (${esc(PATTERN[pattern].toLowerCase())})` : ""}, which works ${esc(ex.focus.filter(f => FOCUS[f]).map(f => FOCUS[f].toLowerCase()).join(" and "))}. Same target: ${esc(ex.sr)}. Best matches first.</p>
    ${aches(u).length ? `<p class="small">Sore today: ${esc(aches(u).map(j => JOINTS[j]).join(", "))}. Change this on the Gym tab.</p>` : ""}
    <section class="card"><div class="pick-list">${ok.length ? ok.map(btn).join("") : `<p class="muted small">No matches in the library yet.</p>`}</div></section>
    ${sore.length ? `<section class="card"><h3 class="h3">Hard on your sore areas</h3><div class="pick-list">${sore.map(btn).join("")}</div></section>` : ""}
  </div></div>`;
}

function riskBlock(m) {
  const j = Object.entries(m.joints || {}).filter(([, v]) => v);
  if (!j.length && !m.risks?.length && !m.heavy) return "";
  return `<div class="risk"><h4>Joints and injury risks</h4>
    ${j.length ? `<div class="joint-chips">${j.map(([k, v]) => `<span class="jchip ${v === 2 ? "high" : ""}">${esc(JOINTS[k])}: ${v === 2 ? "high load" : "some load"}</span>`).join("")}</div>` : ""}
    ${m.risks?.length ? `<ul class="risks">${m.risks.map(r => `<li><b>${esc(r.risk)}.</b> ${esc(r.avoid || "")}</li>`).join("")}</ul>` : ""}
    ${m.heavy ? `<p class="small"><b>At our gym (dumbbells to about ${GYM.maxDumbbell} lb):</b> ${esc(m.heavy)}</p>` : ""}
    <p class="small muted">General guidance, not medical advice. Sharp or lasting pain is worth a doctor or physical therapist visit.</p></div>`;
}

// ---------------------------------------------------------------- GYM LIBRARY
function viewGym() {
  const F = state.libF; const u = state.viewUser;
  const all = allLibrary();
  const sore = aches(u);
  let list = all.filter(m =>
    (F.equip === "all" || m.equip === F.equip) &&
    (F.focus === "all" || (m.focus || []).includes(F.focus) || (m.focus2 || []).includes(F.focus)) &&
    (F.pattern === "all" || m.pattern === F.pattern) &&
    (F.difficulty === "all" || String(m.difficulty) === F.difficulty) &&
    (F.effort === "all" || String(m.effort) === F.effort) &&
    (F.impact === "all" || (m.impact || 0) <= +F.impact) &&
    (!F.q || m.name.toLowerCase().includes(F.q.toLowerCase())));
  const hiddenBySore = F.hideSore === "yes" ? list.filter(m => conflicts(m, u).high.length) : [];
  list = list.filter(m => !hiddenBySore.includes(m));
  const sorts = {
    name: (a, b) => a.name.localeCompare(b.name),
    easy: (a, b) => a.difficulty - b.difficulty || a.name.localeCompare(b.name),
    hard: (a, b) => b.difficulty - a.difficulty || a.name.localeCompare(b.name),
    light: (a, b) => a.effort - b.effort || a.name.localeCompare(b.name),
    heavy: (a, b) => b.effort - a.effort || a.name.localeCompare(b.name),
    impact: (a, b) => (a.impact || 0) - (b.impact || 0) || a.name.localeCompare(b.name)
  };
  list.sort(sorts[F.sort] || sorts.name);
  const equipCounts = Object.fromEntries(Object.keys(EQUIP).map(k => [k, all.filter(m => m.equip === k).length]));
  const sel = (k, label, opts) => `<label class="field">${label}<select data-act="libSel" data-k="${k}">${opts.map(([v, l]) => `<option value="${v}" ${String(F[k]) === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
  const chips = (k, opts) => `<div class="focus-chips">${opts.map(([v, l]) => `<button type="button" data-act="libF" data-k="${k}" data-v="${v}" aria-pressed="${F[k] === v}">${esc(l)}</button>`).join("")}</div>`;
  const editing = state.libEdit ? (state.libEdit === "new" ? {} : libItem(state.libEdit)) : null;
  const ap = state.addPlan;
  const hidden = hiddenBuiltins();
  const quick = Object.values(ALL_EX).filter(e => /machine|cable|smith|pulldown|pec|deck|press \(|leg press|captain|row machine|torso/i.test(e.n) && !all.some(m => m.name.toLowerCase() === e.n.toLowerCase()));
  const seen = new Set(); const quickU = quick.filter(e => !seen.has(e.n) && seen.add(e.n));
  return `<section class="card">
    <div class="between"><h2 class="h2">Gym library</h2>${personToggle()}</div>
    <p class="small muted">${all.length} exercises. ${esc(GYM.name)} dumbbells go to about ${GYM.maxDumbbell} lb. Swaps and "Add an exercise" pull from here.</p>
    ${ap ? `<div class="banner">Adding to ${ap.who === "both" ? "both plans" : PROFILES[ap.who].name + "'s plan"}: tap <b>Add to plan</b> on any exercise. <button class="btn small" data-act="apCancel">Cancel</button></div>` : ""}
    <label class="field">Search<input type="text" id="lib-q" data-act="libQ" value="${esc(F.q)}" placeholder="Row, lunge, press…" autocomplete="off"></label>
    <div class="field"><span>Equipment</span>${chips("equip", [["all", `All ${all.length}`], ...Object.entries(EQUIP).filter(([k]) => equipCounts[k]).map(([k, l]) => [k, `${l} ${equipCounts[k]}`])])}</div>
    <div class="field"><span>Focus</span>${chips("focus", [["all", "All"], ...GROUPS.map(g => [g, FOCUS[g]])])}</div>
    <details class="more"><summary>More filters and sorting</summary><div class="panel"><div class="grid2">
      ${sel("pattern", "Movement", [["all", "Any"], ...Object.entries(PATTERN)])}
      ${sel("difficulty", "Difficulty", [["all", "Any"], ["1", "Beginner"], ["2", "Intermediate"], ["3", "Advanced"]])}
      ${sel("effort", "Effort", [["all", "Any"], ["1", "Light"], ["2", "Moderate"], ["3", "Hard"]])}
      ${sel("impact", "Impact", [["all", "Any"], ["0", "None only"], ["1", "Low or none"]])}
      ${sel("sort", "Sort by", [["name", "Name"], ["easy", "Easiest first"], ["hard", "Hardest first"], ["light", "Least effort"], ["heavy", "Most effort"], ["impact", "Lowest impact"]])}
    </div></div></details>
    <div class="field"><span>${PROFILES[u].name}'s sore spots today</span><div class="focus-chips">${Object.entries(JOINTS).map(([k, l]) => `<button type="button" class="ache" data-act="ache" data-v="${k}" aria-pressed="${sore.includes(k)}">${esc(l)}</button>`).join("")}</div></div>
    ${sore.length ? `<label class="field">Exercises that load sore spots heavily<select data-act="libSel" data-k="hideSore"><option value="yes" ${F.hideSore === "yes" ? "selected" : ""}>Hide them</option><option value="no" ${F.hideSore !== "yes" ? "selected" : ""}>Show them with a warning</option></select></label>` : ""}
    <div class="between"><span class="small muted mono">Showing ${list.length}${hiddenBySore.length ? ` · ${hiddenBySore.length} hidden for sore spots` : ""}</span><button class="btn small" data-act="libNew">+ New exercise or machine</button></div>
  </section>
  ${editing ? libForm(editing) : ""}
  ${list.map(m => libCard(m, u)).join("") || `<section class="card"><p class="muted">Nothing matches these filters.</p></section>`}
  ${quickU.length ? `<section class="card"><details class="more"><summary>Quick add machines from our plan (${quickU.length})</summary><div class="panel"><p class="small muted">For when you're ready to add the real machines. One tap adds it with the plan's focus areas; edit it afterwards to fill in joints and risks.</p><div class="pick-list">${quickU.map(e => `<button class="list-btn" data-act="libQuick" data-id="${e.id}"><b>${esc(e.n)}</b><span class="small muted">${esc(e.focus.filter(x => GROUPS.includes(x)).map(x => FOCUS[x]).join(", "))}</span></button>`).join("")}</div></div></details></section>` : ""}
  ${hidden.length ? `<section class="card"><h3 class="h3">Hidden exercises</h3>${hidden.map(d => { const b = BUILTIN.find(x => x.id === d.id); return `<div class="list-item"><span>${esc(b.name)}</span><button class="btn small" data-act="libRestore" data-id="${esc(d.id)}">Restore</button></div>`; }).join("")}</section>` : ""}`;
}
function libCard(m, u) {
  const c = conflicts(m, u);
  return `<article class="card lib-card">
    <div class="head"><h3 class="name">${esc(m.name)}</h3><span class="sr">${esc(m.sr || "")}</span></div>
    <div class="small muted">${esc([EQUIP[m.equip], PATTERN[m.pattern], POSITION[m.position], m.unilateral ? "One side at a time" : ""].filter(Boolean).join(" · "))}</div>
    <div class="small"><b>${esc((m.focus || []).map(f => FOCUS[f]).join(", "))}</b>${m.focus2?.length ? `<span class="muted"> · also ${esc(m.focus2.map(f => FOCUS[f].toLowerCase()).join(", "))}</span>` : ""}</div>
    <div class="meters small"><span>Difficulty <b class="mono">${dots(m.difficulty)}</b></span><span>Effort <b class="mono">${dots(m.effort)}</b></span><span>Impact <b>${LEVEL.impact[m.impact || 0]}</b></span></div>
    ${c.high.length ? `<div class="pill hold">Hard on your ${esc(c.high.map(j => JOINTS[j].toLowerCase()).join(" and "))} today.</div>` : c.some.length ? `<div class="small warn-text">Some load on your ${esc(c.some.map(j => JOINTS[j].toLowerCase()).join(" and "))}.</div>` : ""}
    <details class="more"><summary>How to, risks &amp; video</summary><div class="panel">
      ${m.how ? `<p>${esc(m.how)}</p>` : ""}
      <a class="video" href="${yt(m.name)}" target="_blank" rel="noopener">Watch form videos</a>
      ${riskBlock(m)}
    </div></details>
    <div class="row"><button class="btn small" data-act="libToday" data-id="${esc(m.id)}">Add to today</button><button class="btn small" data-act="libPlan" data-id="${esc(m.id)}">Add to plan</button><button class="btn small" data-act="libEdit" data-id="${esc(m.id)}">Edit</button></div>
  </article>`;
}
function libForm(m) {
  const isNew = !m.id; const j = m.joints || {};
  const focus = m.focus || [];
  const opt = (obj, cur) => Object.entries(obj).map(([k, l]) => `<option value="${k}" ${cur === k ? "selected" : ""}>${esc(l)}</option>`).join("");
  const lvl = (name, arr, cur, start = 1) => `<select id="lib-${name}">${arr.map((l, i) => i >= start ? `<option value="${i}" ${+cur === i ? "selected" : ""}>${esc(l)}</option>` : "").join("")}</select>`;
  const risksText = (m.risks || []).map(r => `${r.area ? (JOINTS[r.area] || r.area) + ": " : ""}${r.risk}${r.avoid ? " — " + r.avoid : ""}`).join("\n");
  return `<section class="card" id="lib-form"><h3 class="h3">${isNew ? "New exercise or machine" : `Edit ${esc(m.name)}`}</h3>
    <label class="field">Name<input type="text" id="lib-name" value="${esc(m.name || "")}" placeholder="Hip Adductor Machine"></label>
    <div class="field"><span>Main focus (pick all that apply)</span><div class="focus-chips" id="lib-focus">${GROUPS.map(g => `<button type="button" data-act="libFocus" data-v="${g}" aria-pressed="${focus.includes(g)}">${FOCUS[g]}</button>`).join("")}</div></div>
    <div class="grid2">
      <label class="field">Equipment<select id="lib-equip">${opt(EQUIP, m.equip || "machine")}</select></label>
      <label class="field">Movement<select id="lib-pattern"><option value="">Not set</option>${opt(PATTERN, m.pattern)}</select></label>
      <label class="field">Position<select id="lib-position"><option value="">Not set</option>${opt(POSITION, m.position)}</select></label>
      <label class="field">What you track<select id="lib-kind">${opt(KIND_LABEL, m.kind || "load")}</select></label>
      <label class="field">Difficulty${lvl("difficulty", LEVEL.difficulty, m.difficulty || 1)}</label>
      <label class="field">Effort${lvl("effort", LEVEL.effort, m.effort || 2)}</label>
      <label class="field">Impact${lvl("impact", LEVEL.impact, m.impact || 0, 0)}</label>
      <label class="field">Sets × reps<input type="text" id="lib-sr" value="${esc(m.sr || "3 × 10")}"></label>
    </div>
    <label class="check"><input type="checkbox" id="lib-db" ${m.db ? "checked" : ""}><span>Dumbbells (weight per hand)</span></label>
    <label class="check"><input type="checkbox" id="lib-uni" ${m.unilateral ? "checked" : ""}><span>One side at a time</span></label>
    <div class="field"><span>Joint load</span><div class="grid2">${Object.entries(JOINTS).map(([k, l]) => `<label class="field">${esc(l)}<select data-joint="${k}"><option value="0">None</option><option value="1" ${j[k] === 1 ? "selected" : ""}>Some</option><option value="2" ${j[k] === 2 ? "selected" : ""}>High</option></select></label>`).join("")}</div></div>
    <label class="field">How to do it<textarea id="lib-how" placeholder="Seat setting, grip, the movement…">${esc(m.how || m.notes || "")}</textarea></label>
    <label class="field">Injury risks, one per line (Area: what can go wrong — how to avoid it)<textarea id="lib-risks" placeholder="Knees: pain from locking out — stop just short of straight">${esc(risksText)}</textarea></label>
    <div class="row"><button class="btn primary" data-act="libSave">${isNew ? "Add to library" : "Save changes"}</button><button class="btn" data-act="libCancel">Cancel</button>
      ${isNew ? "" : `<button class="btn danger" data-act="libDelete" data-id="${esc(m.id)}">${state.confirmDel === m.id ? "Tap again to confirm" : m.builtin ? "Hide" : "Delete"}</button>`}</div>
  </section>`;
}
function saveLibrary() {
  const name = $("#lib-name").value.trim(); if (!name) { toast("Give it a name first."); return; }
  const focus = [...document.querySelectorAll("#lib-focus [aria-pressed=true]")].map(b => b.dataset.v);
  if (!focus.length) { toast("Pick at least one focus area, so it can show up as a swap."); return; }
  const joints = {}; document.querySelectorAll("[data-joint]").forEach(sel => { if (+sel.value) joints[sel.dataset.joint] = +sel.value; });
  const areaByLabel = Object.fromEntries(Object.entries(JOINTS).map(([k, l]) => [l.toLowerCase(), k]));
  const risks = $("#lib-risks").value.split("\n").map(x => x.trim()).filter(Boolean).map(line => {
    const m = line.match(/^([^:]{2,20}):\s*(.*)$/); let area = "", rest = line;
    if (m && areaByLabel[m[1].toLowerCase()]) { area = areaByLabel[m[1].toLowerCase()]; rest = m[2]; }
    const [risk, avoid = ""] = rest.split(/\s+—\s+|\s+-\s+/);
    return { area, risk: risk.replace(/\.$/, ""), avoid };
  });
  const id = state.libEdit !== "new" ? state.libEdit : slug(name);
  save("library", id, {
    name, focus, equip: $("#lib-equip").value, pattern: $("#lib-pattern").value, position: $("#lib-position").value, kind: $("#lib-kind").value,
    difficulty: +$("#lib-difficulty").value, effort: +$("#lib-effort").value, impact: +$("#lib-impact").value, sr: $("#lib-sr").value.trim() || "3 × 10",
    db: $("#lib-db").checked, unilateral: $("#lib-uni").checked, joints, how: $("#lib-how").value.trim(), risks
  });
  toast(state.libEdit !== "new" ? "Saved." : `Added ${name}.`); state.libEdit = null; render();
}

// ---------------------------------------------------------------- plan editing
function planEditBox(u, week, day) {
  const edits = dayEdits(u, week, day);
  const removed = edits.remove.map(id => ALL_EX[id]).filter(Boolean);
  return `<div class="banner">Editing ${esc(P(u).name)}'s plan for Week ${week} ${DAY_NAMES[day]}. Move, retarget or remove exercises on each card below.</div>
    <label class="field">Day name<input type="text" data-act="planTitle" value="${esc(dayTitle(u, week, day))}"></label>
    ${removed.length ? `<div class="field"><span>Removed from this day</span>${removed.map(e => `<div class="list-item"><span>${esc(e.n)}</span><button class="btn small" data-act="planRestore" data-id="${e.id}">Put back</button></div>`).join("")}</div>` : ""}
    <div class="row"><button class="btn small" data-act="planFromLib">+ Add from the library</button>
      ${other(u) !== u ? `<button class="btn small" data-act="planCopy">Copy this day to ${esc(P(other(u)).name)}</button>` : ""}
      <button class="btn small danger" data-act="planClear">${state.confirmDel === "planClear" ? "Tap again to clear" : "Clear this day"}</button>
      <button class="btn small" data-act="planReset">${state.confirmDel === "planReset" ? "Tap again to reset" : "Reset to original"}</button></div>`;
}
function openAddPlan(libId) {
  const pre = state.addPlan || {};
  state.addPlan = { libId, who: pre.who || state.viewUser, week: pre.week || state.sel?.week || "A", day: pre.day || state.sel?.day || "Mon" };
  state.overlay = "addplan"; drawAddPlan();
}
function drawAddPlan() {
  const a = state.addPlan; const m = libItem(a.libId);
  const segA = (k, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button data-act="apSet" data-k="${k}" data-v="${v}" aria-pressed="${a[k] === v}">${esc(l)}</button>`).join("")}</div>`;
  $("#overlay").innerHTML = `<div class="overlay" role="dialog" aria-label="Add to plan"><div class="inner">
    <div class="between"><h2 class="h2">Add to plan</h2><button class="btn small" data-act="closeOverlay">Close</button></div>
    <p><b>${esc(m.name)}</b> · ${esc(m.sr)}</p>
    <div class="field"><span>Whose plan</span>${segA("who", [...profileIds().map(id => [id, P(id).name]), ...(profileIds().length > 1 ? [["both", profileIds().length > 2 ? "Me + partner" : "Both"]] : [])])}</div>
    <div class="field"><span>Week</span>${segA("week", [["A", "Week A"], ["B", "Week B"], ["AB", "Both weeks"]])}</div>
    <div class="field"><span>Day</span><div class="chips">${DAYS.map(d => `<button data-act="apSet" data-k="day" data-v="${d}" aria-pressed="${a.day === d}">${d}<small>${esc(PLAN.A[d].title.split(",")[0])}</small></button>`).join("")}</div></div>
    <button class="btn primary block" data-act="apSave">Add to plan</button>
  </div></div>`;
}
function saveAddPlan() {
  const a = state.addPlan; const id = `lib-${a.libId}`;
  const users = a.who === "both" ? [state.user, other(state.user)] : [a.who]; const weeks = a.week === "AB" ? ["A", "B"] : [a.week];
  editPlan(users, weeks, a.day, d => { if (!d.add.includes(id)) d.add.push(id); });
  toast(`Added to ${a.who === "both" ? "both plans" : PROFILES[a.who].name + "'s plan"}: ${a.week === "AB" ? "Weeks A and B" : "Week " + a.week} ${DAY_NAMES[a.day]}.`);
  state.addPlan = null; closeOverlay(); render();
}

// ---------------------------------------------------------------- appearance
const THEMES = {
  bunny: { name: "Bunny", desc: "Our logo colors: charcoal and hot pink.", sw: ["#2d2b2b", "#fb40ad", "#f5f0f2"] },
  floor: { name: "Gym Floor", desc: "The original. Follows light/dark.", sw: ["#eceee9", "#2f6b5e", "#b5532f"] },
  synthwave: { name: "Synthwave", desc: "Neon night drive.", sw: ["#1b0633", "#ff3fd8", "#3ff6ff"] },
  iron: { name: "Iron & Chalk", desc: "Rubber floor, plate colors.", sw: ["#18191b", "#d9412f", "#e3b23c"] },
  arcade: { name: "Arcade", desc: "Chunky pixels, high score.", sw: ["#0a0a12", "#ffd400", "#39ff88"] },
  clean: { name: "Clean Light", desc: "Calm and bright.", sw: ["#f5f6f8", "#3563e9", "#e0662e"] }
};
const AVATARS = ["🐺", "🦊", "🐻", "🦁", "🐯", "🦍", "🐂", "🦅", "🐉", "🦈", "🐙", "🦄", "🔥", "⚡", "💪", "🏋️", "🚲", "🌙", "⭐", "🎧"];
const FUN_LEVELS = { light: "Light: record celebrations and badges", medium: "Medium: plus streaks, progress ring, finish screen and high-fives", full: "Full: plus points, levels and a weekly leaderboard" };
const funAt = (lvl, u = state.user) => ({ light: 1, medium: 2, full: 3 })[P(u).fun || "medium"] >= ({ light: 1, medium: 2, full: 3 })[lvl];

function applyAppearance() {
  const p = state.user ? P(state.user) : null; const b = document.body;
  b.dataset.skin = p?.theme && THEMES[p.theme] ? p.theme : "bunny";
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  const acc = p ? (p.accent || (b.dataset.skin === "floor" ? (dark ? `color-mix(in srgb, ${p.color} 55%, #ffffff)` : p.color) : "")) : "";
  if (acc) b.style.setProperty("--accent", acc); else b.style.removeProperty("--accent");
  A.load(p ? { ...(p.textSize && !p.a11y?.textSize ? { textSize: p.textSize } : {}), ...(p.a11y || {}) } : null, state.user || null); A.apply();
  const bg = getComputedStyle(b).getPropertyValue("--bg").trim();
  // Light or dark page, so the logo with the right text color shows.
  const probe = document.createElement("i"); probe.style.color = "var(--bg)"; b.appendChild(probe);
  const [r, g, bl] = (getComputedStyle(probe).color.match(/[\d.]+/g) || [0, 0, 0]).map(Number); probe.remove();
  b.dataset.tone = (0.299 * r + 0.587 * g + 0.114 * bl) > 140 ? "light" : "dark";
  document.querySelector("meta[name=theme-color]")?.setAttribute("content", bg.startsWith("#") ? bg : "#12181a");
}
function avatarHtml(id, big) {
  const p = P(id);
  return `<span class="av ${big ? "big" : ""}" style="--c:${esc(p.color)}" aria-hidden="true">${esc(p.avatar || (p.name || "?")[0].toUpperCase())}</span>`;
}
function saveProfile(id, fields) {
  const exists = state.data.profiles.some(p => p.id === id);
  const base = exists ? {} : (({ id: _i, updatedAt: _u, ...rest }) => rest)(P(id));
  patch("profiles", id, { ...base, ...fields });
  profMemo = { src: null, map: {} };
}
function celebrate(kind, text) {
  const p = P(state.user);
  if (text) toast(text);
  const colors = [cssVar("--accent"), cssVar("--plate"), cssVar("--good"), cssVar("--warn")].filter(Boolean);
  if (A.get().calm) return;
  if (kind === "pr" || kind === "badge" || kind === "level" || (kind === "finish" && funAt("medium"))) { if (!A.reduceMotion()) F.confetti(colors); if (p.sound) F.fanfare(); A.buzz([60, 40, 120]); }
  else if (p.sound && kind !== "quiet") F.chime();
}

// ---------------------------------------------------------------- gym settings, weight steps, lighter weeks
const gymSet = () => state.data.settings.find(x => x.id === "gym") || {};
function stepFor(db, kind, w, dir) {
  if (kind === "assist") return 5;
  if (db) { const up = +gymSet().dbSmallUpTo || 25, small = +gymSet().dbSmallStep || 2.5; return (dir > 0 ? w < up : w <= up) ? small : 5; }
  return +gymSet().machineStep || 5;
}
const roundTo = (w, step) => Math.max(0, Math.round(w / step) * step);
const deloadOf = u => state.data.settings.find(x => x.id === `deload_${u}`) || null;
const deloadActive = (u, date) => { const d = deloadOf(u); return !!(d && d.from && date >= d.from && date <= d.to); };
function deloadSuggestion(u) {
  if (deloadActive(u, TODAY())) return null;
  const ss = S.userSessions(state.data.sessions, u).filter(s => (s.exercises || []).some(e => e.sets?.length));
  if (!ss.length) return null;
  const since = deloadOf(u)?.to || ss[0].date;
  const weeks = Math.floor(S.daysBetween(since, TODAY()) / 7);
  if (weeks >= 6) return `It's been ${weeks} weeks of steady training. A lighter week now helps your joints recover and keeps progress coming.`;
  const recent = ss.filter(s => s.date >= S.addDays(TODAY(), -14)).flatMap(s => (s.exercises || []).flatMap(e => e.sets || []));
  if (recent.length >= 30 && recent.filter(x => x.d === 3).length / recent.length >= .45) return "Almost half your sets in the last two weeks felt hard. A lighter week could help you bounce back stronger.";
  return null;
}
function lightSets(sets, db) {
  return sets.slice(0, Math.max(2, sets.length - 1)).map(s => ({ ...s, w: roundTo((+s.w || 0) * .6, db ? 2.5 : 5) }));
}

// ---------------------------------------------------------------- warm-ups
const WARMUPS = {
  Mon: ["Arm circles, 10 each direction", "Cable or band pull-aparts, 15", "Incline push-ups against a bench, 10", "Shoulder rolls, 10"],
  Tue: ["Arm circles, 10 each direction", "Light straight-arm cable pulldown, 15", "Shoulder rolls, 10", "Light lat pulldown, 12"],
  Wed: ["Bodyweight squats to a bench, 10", "Glute bridges on the floor, 12", "Leg swings, 10 each leg (hold something)", "Bodyweight reverse lunges, 6 each leg"],
  Thu: ["Standing knee hugs, 8 each leg", "Bodyweight squats to a bench, 10", "Standing side bends, 10 each side", "Dead bug, 5 each side"]
};
function warmupCard(u, date, s, list) {
  if (s?.warmup && !state.editing.has(editKey(u, date, "warmup"))) return `<section class="card done-card"><div class="head"><h3 class="name"><span class="tick" aria-hidden="true">✓</span><span class="visually-hidden">Done: </span>Warm-up</h3><button class="btn small" data-act="undoWarmup">Undo</button></div></section>`;
  const first = list.find(x => (x.ex.kind === "load") && !s?.exercises?.some(e => e.id === x.ex.id));
  let ramp = "";
  if (first) {
    const d = getDraft(u, date, first.ex, null); const def = defOf(first.ex, d.variant);
    const top = Math.max(0, ...d.sets.map(x => +x.w || 0));
    if (top > 0) ramp = `<li><b>Ramp-up sets for ${esc(def.name)}:</b> 10 reps at about ${roundTo(top * .5, def.db ? 2.5 : 5)} lb${def.db ? " each" : ""}, then 5 reps at about ${roundTo(top * .75, def.db ? 2.5 : 5)} lb${def.db ? " each" : ""}.</li>`;
  }
  return `<section class="card"><details class="more" ${s?.warmup ? "" : "open"}><summary>Warm-up · 8 minutes</summary><div class="panel">
    <ul class="warmup small"><li><b>5 minutes easy</b> on the bike or elliptical, until you're slightly warm.</li>${(WARMUPS[state.sel.day] || WARMUPS.Mon).map(m => `<li>${esc(m)}</li>`).join("")}${ramp}</ul>
    <button class="btn primary block" data-act="warmupDone">Warm-up done</button></div></details></section>`;
}

// ---------------------------------------------------------------- start / finish
let elapsedTick;
function workoutBar(u, date, s) {
  clearInterval(elapsedTick);
  if (date !== TODAY() && !s?.startedAt) return "";
  if (!s?.startedAt) return `<button class="btn primary block" data-act="startWorkout">Start workout</button>`;
  if (!s.finishedAt) {
    elapsedTick = setInterval(() => { const el = $("#elapsed"); if (el) el.textContent = fmtDur(Date.now() - s.startedAt); else clearInterval(elapsedTick); }, 1000);
    return `<div class="timerbar"><span>Workout time <b class="mono" id="elapsed">${fmtDur(Date.now() - s.startedAt)}</b></span><button class="btn small primary" data-act="finishWorkout">Finish workout</button></div>`;
  }
  return `<div class="timerbar"><span>Finished in <b class="mono">${fmtDur(s.finishedAt - s.startedAt)}</b></span><button class="btn small" data-act="showSummary">Summary</button></div>`;
}
const fmtDur = ms => { const t = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), sec = t % 60; return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`; };
function summaryFor(u, date) {
  const s = sessionFor(u, date); if (!s) return null;
  const ex = (s.exercises || []).filter(e => !e.skipped && e.sets?.length);
  const vol = Math.round(ex.reduce((t, e) => t + F.volumeOf(e), 0));
  const prs = F.prEvents(state.data.sessions, u).filter(p => p.date === date);
  const pts = F.points(state.data.sessions, state.data.activities, u, date, date);
  return { s, ex, sets: ex.reduce((t, e) => t + e.sets.length, 0), vol, prs, pts, dur: s.finishedAt && s.startedAt ? s.finishedAt - s.startedAt : null };
}
function openSummary(u, date) {
  const r = summaryFor(u, date); if (!r) return;
  state.overlay = "summary";
  const fw = F.funWeight(r.vol);
  $("#overlay").innerHTML = `<div class="overlay" role="dialog" aria-label="Workout summary"><div class="inner">
    <div class="between"><span class="eyebrow">${esc(P(u).name)} · ${S.fmtDate(date)}</span><button class="btn small" data-act="closeOverlay">Close</button></div>
    <div class="finish-hero">${avatarHtml(u, true)}<h2 class="h2">${esc(F.say(P(state.user).voice, "finish"))}</h2>
      ${r.dur ? `<div class="big mono">${fmtDur(r.dur)}</div><div class="muted small">workout time</div>` : ""}</div>
    <div class="stats">
      <div class="stat"><div class="v">${r.ex.length}</div><div class="l">Exercises</div></div>
      <div class="stat"><div class="v">${r.sets}</div><div class="l">Sets</div></div>
      <div class="stat"><div class="v">${r.vol.toLocaleString()}</div><div class="l">lb moved${fw ? ` · ${esc(fw)}` : ""}</div></div>
      ${r.s.cardio?.done ? `<div class="stat"><div class="v">${r.s.cardio.minutes || 0}</div><div class="l">Cardio minutes</div></div>` : ""}
      ${funAt("full") ? `<div class="stat"><div class="v">+${r.pts}</div><div class="l">Points today</div></div>` : ""}
    </div>
    ${r.prs.length ? `<section class="card"><h3 class="h3">New personal bests</h3><ul>${r.prs.map(p => `<li>${esc(p.name)}</li>`).join("")}</ul></section>` : ""}
    <section class="card"><h3 class="h3">What you did</h3>${r.ex.map(e => `<div class="list-item"><span>${esc(e.name)}</span><span class="small muted mono">${esc(S.describeSets(e.kind, e.db, e.sets))}</span></div>`).join("")}</section>
  </div></div>`;
}

// ---------------------------------------------------------------- supersets
function supersetIdeas(u, date, list, s) {
  const pending = list.filter(x => !s?.exercises?.some(e => e.id === x.ex.id) && x.ex.kind !== "time");
  const upper = ["chest", "shoulders", "arms", "back"], lower = ["legs", "glutes", "calves"];
  const zone = ex => ex.focus.some(f => lower.includes(f)) ? "lower" : ex.focus.some(f => upper.includes(f)) ? "upper" : "core";
  const pairs = []; const used = new Set();
  for (let i = 0; i < pending.length; i++) for (let j = i + 1; j < pending.length; j++) {
    const a = pending[i].ex, b = pending[j].ex;
    if (used.has(a.id) || used.has(b.id)) continue;
    if (a.focus.some(f => b.focus.includes(f))) continue;
    if (guessEquip(a.n) === guessEquip(b.n) && guessEquip(a.n) === "machine" && a.n === b.n) continue;
    const score = (zone(a) !== zone(b) ? 2 : 0) + (guessEquip(a.n) !== guessEquip(b.n) ? 1 : 0);
    if (score >= 1) { pairs.push([a, b, score]); used.add(a.id); used.add(b.id); }
  }
  if (!pairs.length) return "";
  pairs.sort((x, y) => y[2] - x[2]);
  return `<section class="card"><details class="more"><summary>Superset ideas (${Math.min(3, pairs.length)})</summary><div class="panel">
    <p class="small muted">Do these back to back, then rest. They work different muscles and use different equipment, so you lose less time waiting on machines.</p>
    ${pairs.slice(0, 3).map(([a, b]) => `<div class="stretch"><b>${esc(a.n)} + ${esc(b.n)}</b></div>`).join("")}</div></details></section>`;
}

// ---------------------------------------------------------------- reminders
function reminders(u) {
  const out = []; const t = TODAY();
  const lastOf = f => state.data.body.filter(b => b.user === u && b[f] != null && b[f] !== "").map(b => b.date).sort().pop();
  const lw = lastOf("weight"); if (!lw || S.daysBetween(lw, t) >= 7) out.push({ id: "weigh", text: lw ? `Weigh-in: last one was ${S.fmtDate(lw)}.` : "Add a first weigh-in on the Body tab as your starting point.", view: "body" });
  const lm = lastOf("waist"); if (!lm || S.daysBetween(lm, t) >= 14) out.push({ id: "measure", text: lm ? `Measurements are due (every two weeks; last ${S.fmtDate(lm)}).` : "Take your first measurements on the Body tab.", view: "body" });
  if (P(u).cardio === "intervals") { const lh = lastOf("restingHr"); if (!lh || S.daysBetween(lh, t) >= 7) out.push({ id: "hr", text: "Log your resting heart rate this week (first thing in the morning).", view: "body" }); }
  const ci = S.cycleInfo(t, cycleStart()); const left = S.daysBetween(t, ci.end);
  if (left <= 3) out.push({ id: "report", text: `This cycle ends ${S.fmtDate(ci.end)}. Check the cycle report and paste it to Claude for adjustments.`, view: "report" });
  const dismissed = store.get(`twp-rem-${u}-${t}`, []);
  return out.filter(r => !dismissed.includes(r.id));
}

// ---------------------------------------------------------------- achievements (badges, levels, high-fives)
let achieveTimer;
function checkAchievements() {
  clearTimeout(achieveTimer);
  achieveTimer = setTimeout(() => {
    const u = state.user; if (!u || state.flags.sessions?.fromCache) return;
    const got = F.earnedBadges(state.data.sessions, state.data.body, state.data.activities, u, TODAY());
    const key = `twp-badges-${u}`; const seen = store.get(key, null);
    store.set(key, [...got]);
    if (seen) for (const b of F.BADGES) if (got.has(b.id) && !seen.includes(b.id)) { celebrate("badge", `${b.icon} ${F.say(P(u).voice, "badge", { name: b.name })}`); break; }
    if (funAt("full")) {
      const lvl = F.level(F.points(state.data.sessions, state.data.activities, u)).i; const lk = `twp-level-${u}`; const prev = store.get(lk, null);
      store.set(lk, lvl); if (prev != null && lvl > prev) celebrate("level", F.say(P(u).voice, "level", { name: F.LEVELS[lvl] }));
    }
  }, 600);
}
function handlePings() {
  const u = state.user; if (!u) return;
  const p = state.data.pings.find(x => x.id === `to_${u}`); if (!p) return;
  // First run on this phone: still show a high-five from the last 12 hours.
  const key = `twp-hi5-${u}`; const seen = store.get(key, Date.now() - 12 * 3600e3);
  store.set(key, Math.max(p.at, seen));
  if (p.at > seen && funAt("medium")) {
    const el = document.createElement("div"); el.className = "hi5-burst"; el.textContent = "🙌"; document.body.appendChild(el); setTimeout(() => el.remove(), 1400);
    toast(F.say(P(u).voice, "hi5got", { name: P(p.from)?.name || "Your partner" })); if (P(u).sound) F.chime(); navigator.vibrate?.([80, 60, 80]);
  }
}
function funHeader(u) {
  if (!funAt("medium", u) && !funAt("light", u)) return "";
  const parts = [];
  if (funAt("medium")) {
    const st = F.streaks(state.data.sessions, u, TODAY());
    parts.push(`<span class="small">🔥 <b>${st.current}</b>-week streak · <b>${st.thisWeek}</b> of ${st.need}+ workouts this week</span>`);
  }
  if (funAt("full")) {
    const all = F.points(state.data.sessions, state.data.activities, u); const lv = F.level(all);
    const wk = F.points(state.data.sessions, state.data.activities, u, S.mondayOf(TODAY()), TODAY());
    parts.push(`<div class="small"><b>Level ${lv.i + 1} · ${esc(lv.name)}</b> · ${wk} pts this week</div>${lv.next ? `<div class="level-bar"><div style="width:${Math.round(lv.into / lv.next * 100)}%"></div></div>` : ""}`);
  }
  return parts.join("");
}
function ring(done, total) {
  const r = 24, c = 2 * Math.PI * r, pct = total ? done / total : 0;
  return `<svg class="ring-svg" viewBox="0 0 56 56" aria-hidden="true"><circle class="bg" cx="28" cy="28" r="${r}"/><circle class="fg" cx="28" cy="28" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/><text x="28" y="32" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">${done}/${total}</text></svg>`;
}

// ---------------------------------------------------------------- plan builder helpers
const dayEdits = (u, week, day) => ({ add: [], remove: [], order: [], sr: {}, title: "", ...(planEdits(u)[`${week}-${day}`] || {}) });
const dayTitle = (u, week, day) => dayEdits(u, week, day).title || PLAN[week][day].title;
const srFor = (u, ex, def) => dayEdits(u, state.sel.week, state.sel.day).sr[ex.id] || def.sr;

// ---------------------------------------------------------------- profile setup (the interview)
function openProfileForm(id) {
  state.overlay = "profile";
  const p = id ? P(id) : { ...PROFILE_DEFAULTS, name: "", color: ["#2f6b5e", "#4b5d8a", "#b5532f", "#8a5a9c", "#2e7d4f", "#9a6b12"][profileIds().length % 6] };
  state.profForm = { id, avatar: p.avatar || "", focus: [...(p.focus || [])], pain: [...(p.pain || [])], defaultVariant: p.defaultVariant || "std", cardio: p.cardio || "steady" };
  drawProfileForm(p);
}
function drawProfileForm(p) {
  const f = state.profForm;
  const chipSet = (key, opts) => `<div class="focus-chips">${opts.map(([v, l]) => `<button type="button" data-act="pfToggle" data-k="${key}" data-v="${v}" aria-pressed="${f[key].includes(v)}">${esc(l)}</button>`).join("")}</div>`;
  const one = (key, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" data-act="pfOne" data-k="${key}" data-v="${v}" aria-pressed="${f[key] === v}">${esc(l)}</button>`).join("")}</div>`;
  $("#overlay").innerHTML = `<div class="overlay" role="dialog" aria-label="Profile"><div class="inner">
    <div class="between"><h2 class="h2">${f.id ? `Edit ${esc(p.name)}` : "New person"}</h2><button class="btn small" data-act="closeOverlay">Close</button></div>
    <section class="card"><label class="field">Name<input type="text" id="pf-name" value="${esc(p.name || "")}" placeholder="First name"></label>
      <div class="field"><span>Avatar</span><div class="avatars"><button type="button" data-act="pfAvatar" data-v="" aria-pressed="${!f.avatar}">${esc((p.name || "A")[0].toUpperCase())}</button>${AVATARS.map(a => `<button type="button" data-act="pfAvatar" data-v="${a}" aria-pressed="${f.avatar === a}">${a}</button>`).join("")}</div></div>
      <label class="field">Color<input type="color" id="pf-color" value="${esc(p.color || "#2f6b5e")}"></label></section>
    <section class="card"><h3 class="h3">Goals</h3>
      <label class="field">What do you want out of training?<textarea id="pf-goals" placeholder="Lose fat around the middle, get stronger, better cardio…">${esc(p.focusNote || "")}</textarea></label>
      <div class="field"><span>Focus areas</span>${chipSet("focus", [...GROUPS.filter(g => g !== "cardio").map(g => [g, FOCUS[g]]), ["full", "Full body"], ["cardio", "Cardio fitness"]])}</div></section>
    <section class="card"><h3 class="h3">Aches and injuries</h3>
      <p class="small muted">Areas to track in the daily pain check. You can mark what's sore on any given day from the Gym tab.</p>
      ${chipSet("pain", Object.entries(PAIN_AREAS))}</section>
    <section class="card"><h3 class="h3">Training style</h3>
      <div class="field"><span>Default exercise version</span>${one("defaultVariant", [["std", "Standard"], ["hard", "Harder"]])}</div>
      <div class="field"><span>Gym cardio</span>${one("cardio", [["steady", "Steady (bike, elliptical, walking)"], ["intervals", "Steady + 2 interval days a week"]])}</div>
      <label class="check"><input type="checkbox" id="pf-commute" ${p.commute?.enabled ? "checked" : ""}><span>I bike to work</span></label>
      <label class="field">Round-trip commute miles<input type="number" inputmode="decimal" step="any" id="pf-miles" value="${esc(p.commute?.miles || "")}"></label>
      <label class="field">Notes to yourself, one per line<textarea id="pf-notes" placeholder="Squat to a bench while knees heal">${esc((p.notes || []).join("\n"))}</textarea></label></section>
    <button class="btn primary block" data-act="pfSave">${f.id ? "Save" : "Create profile"}</button>
    ${f.id && !SEEDS[f.id] ? `<button class="btn danger" data-act="pfArchive">${state.confirmDel === "pf" ? "Tap again to remove" : "Remove this person"}</button>` : ""}
  </div></div>`;
}
function saveProfileForm() {
  const f = state.profForm; const name = $("#pf-name").value.trim(); if (!name) { toast("Add a name first."); return; }
  let id = f.id; if (!id) { id = slug(name) || "person"; let n = 2; while (profileIds().includes(id)) id = `${slug(name)}-${n++}`; }
  saveProfile(id, {
    name, avatar: f.avatar, color: $("#pf-color").value, focusNote: $("#pf-goals").value.trim(), focus: f.focus, pain: f.pain.length ? f.pain : ["knees", "shoulders", "lowerBack"],
    defaultVariant: f.defaultVariant, cardio: f.cardio, commute: { enabled: $("#pf-commute").checked, miles: +$("#pf-miles").value || 0 },
    notes: $("#pf-notes").value.split("\n").map(x => x.trim()).filter(Boolean)
  });
  if (!f.id && !state.user) { state.user = id; state.viewUser = id; store.set("twp-user", id); }
  toast(f.id ? "Saved." : `Welcome, ${name}!`); closeOverlay(); render();
}

// ---------------------------------------------------------------- settings
function openSettings() {
  state.overlay = "settings";
  const u = state.user; const p = P(u); const cs = cycleStart(); const ci = S.cycleInfo(TODAY(), cs); const g = gymSet();
  const one = (act, cur, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" data-act="${act}" data-v="${v}" aria-pressed="${cur === v}">${esc(l)}</button>`).join("")}</div>`;
  $("#overlay").innerHTML = `<div class="overlay" role="dialog" aria-label="Settings"><div class="inner">
    <div class="between"><h2 class="h2">Settings</h2><button class="btn small" data-act="closeOverlay">Close</button></div>
    <section class="card"><h3 class="h3">Accessibility</h3>
      <p class="small">${a11yOn() ? `${a11yOn()} option${a11yOn() === 1 ? "" : "s"} changed.` : "Text size, contrast, reading fonts, spoken timers, screen flashes, one-step-at-a-time and more."}</p>
      <button class="btn primary" data-act="openA11y">Accessibility options</button></section>
    ${crewSettings()}
    <section class="card"><h3 class="h3">Who's using this phone</h3>${personToggle("pickUser", u)}
      <div class="row"><button class="btn small" data-act="editProfile">Edit ${esc(p.name)}'s profile</button><button class="btn small" data-act="newProfile">+ New person</button></div>
      ${profileIds().length > 1 ? `<label class="check"><input type="checkbox" data-act="partner" ${state.partner ? "checked" : ""}><span>Partner mode: log for a partner from this phone</span></label>` : ""}
      ${profileIds().length > 2 ? `<div class="field"><span>Training partner</span>${one("pickPartner", other(u), profileIds().filter(id => id !== u).map(id => [id, P(id).name]))}</div>` : ""}</section>
    <section class="card"><h3 class="h3">Look</h3>
      <div class="themes">${Object.entries(THEMES).map(([k, t]) => `<button type="button" class="theme-tile" data-act="setTheme" data-v="${k}" aria-pressed="${(p.theme || "bunny") === k}"><div class="sw" style="background:${t.sw[0]}"><i style="background:${t.sw[1]}"></i><i style="background:${t.sw[2]}"></i></div><b>${esc(t.name)}</b><small>${esc(t.desc)}</small></button>`).join("")}</div>
      <div class="grid2"><label class="field">Accent color<input type="color" data-act="setAccent" value="${esc(p.accent || cssVar("--accent") || "#2f6b5e")}"></label>
      <div class="field"><span>&nbsp;</span><button class="btn small" data-act="resetAccent">Use the theme's color</button></div></div>
      <div class="field"><span>Text size</span>${one("setText", A.get().textSize || "m", Object.entries(A.LABELS.textSize))}</div></section>
    <section class="card"><h3 class="h3">Personality</h3>
      <div class="field"><span>How the app talks to you</span>${one("setVoice", p.voice || "hype", [["hype", "Hype"], ["chill", "Chill"], ["plain", "Just the numbers"]])}</div>
      <div class="field"><span>Fun level</span>${one("setFun", p.fun || "medium", [["light", "Light"], ["medium", "Medium"], ["full", "Full"]])}<p class="small muted">${esc(FUN_LEVELS[p.fun || "medium"])}</p></div>
      <label class="check"><input type="checkbox" data-act="setSound" ${p.sound !== false ? "checked" : ""}><span>Sounds and vibration</span></label></section>
    <section class="card"><h3 class="h3">Our gym</h3>
      <p class="small muted">Shared by everyone. Sets how the + and − buttons step.</p>
      <div class="grid2">
        <label class="field">Small dumbbell step (lb)<input type="number" step="any" data-gym="dbSmallStep" value="${esc(g.dbSmallStep ?? 2.5)}"></label>
        <label class="field">…up to (lb), then 5 lb steps<input type="number" step="any" data-gym="dbSmallUpTo" value="${esc(g.dbSmallUpTo ?? 25)}"></label>
        <label class="field">Machine step (lb)<input type="number" step="any" data-gym="machineStep" value="${esc(g.machineStep ?? 5)}"></label>
        <label class="field">Smith bar weight (lb)<input type="number" step="any" data-gym="smithBar" value="${esc(g.smithBar ?? "")}" placeholder="Check at the gym"></label>
      </div></section>
    <section class="card"><h3 class="h3">Two-week cycle</h3>
      <label class="field">Week A started on (a Monday)<input type="date" data-act="cycleStart" value="${cs}"></label>
      <p class="small muted">Today is in Week ${ci.week}. Shared by everyone.</p></section>
    <section class="card"><h3 class="h3">Install on your phone</h3>
      <p class="small"><b>iPhone:</b> open this page in Safari, tap Share, then Add to Home Screen.</p>
      <p class="small"><b>Android:</b> open it in Chrome, tap the ⋮ menu, then Install app.</p></section>
    <section class="card"><h3 class="h3">Backup</h3>
      <div class="row"><button class="btn" data-act="export">Download backup</button><label class="btn">Restore backup<input type="file" accept="application/json" data-act="import" hidden></label></div></section>
  </div></div>`;
}


// ---------------------------------------------------------------- accessibility options
function setA11y(patch) {
  A.set(patch);
  if (state.user && state.auth?.crewId) saveProfile(state.user, { a11y: A.get(), textSize: A.get().textSize });
  applyAppearance(); render(); if (state.overlay === "a11y") drawA11y();
}
const a11yOn = () => { const a = A.get(); return Object.keys(A.DEFAULTS).filter(k => a[k] !== A.DEFAULTS[k]).length; };
function openA11y() { state.overlay = "a11y"; drawA11y(); }
function drawA11y() {
  const a = A.get();
  const choice = (k, opts, label) => `<div class="field"><span id="lbl-${k}">${esc(label)}</span><div class="seg wrap" role="group" aria-labelledby="lbl-${k}">${opts.map(([v, l, style]) => `<button type="button" data-act="a11ySet" data-k="${k}" data-v="${v}" aria-pressed="${String(a[k]) === String(v)}" ${style ? `style="${style}"` : ""}>${esc(l)}</button>`).join("")}</div></div>`;
  const tog = (k, label, help) => `<label class="check a11y-tog"><input type="checkbox" data-a11y="${k}" ${a[k] ? "checked" : ""}${help ? ` aria-describedby="help-${k}"` : ""}><span><b>${esc(label)}</b>${help ? `<small id="help-${k}">${esc(help)}</small>` : ""}</span></label>`;
  const L = A.LABELS;
  const fonts = { theme: "", atkinson: "font-family:'Atkinson Hyperlegible'", lexend: "font-family:Lexend", dyslexic: "font-family:OpenDyslexic", system: "font-family:system-ui,-apple-system,sans-serif" };
  $("#overlay").innerHTML = `<div class="overlay" role="dialog" aria-labelledby="a11y-title"><div class="inner a11y-panel">
    <div class="between"><h2 class="h2" id="a11y-title">Accessibility</h2><button class="btn small" data-act="closeOverlay">Close</button></div>
    <p class="small">Make the app work the way you do. These follow you to any phone you sign in on.${state.user ? "" : " Saved on this phone until you sign in."}</p>
    <section class="card"><h3 class="h3">Quick setup</h3>
      <p class="small muted">Each one turns on a group of options. You can fine-tune everything below.</p>
      <div class="preset-grid">${Object.entries(A.PRESETS).map(([id, pr]) => `<button type="button" class="btn preset" data-act="a11yPreset" data-v="${id}"><span aria-hidden="true">${pr.icon}</span> ${esc(pr.label)}</button>`).join("")}</div>
      ${a11yOn() ? `<button type="button" class="btn small" data-act="a11yReset">Reset all ${a11yOn()} changes</button>` : `<p class="small muted">Everything is at the default.</p>`}</section>
    <section class="card"><h3 class="h3">Seeing</h3>
      ${choice("textSize", Object.entries(L.textSize).map(([v, l]) => [v, l]), "Text size")}
      ${choice("contrast", Object.entries(L.contrast), "Contrast")}
      ${tog("bold", "Bold text", "Heavier letters everywhere.")}
      ${tog("bigTargets", "Bigger buttons", "Every button and box at least 52 points tall, with more space between them.")}
      ${tog("underline", "Underline links", "So links don't rely on color.")}
      ${tog("focusRing", "Strong focus outline", "A thick, high-visibility outline on whatever is selected, for keyboards, switches and screen readers.")}
      ${tog("colorSafe", "Color-blind-safe colors", "Blue and orange instead of green and red, plus symbols on selected buttons and initials on calendar dots.")}</section>
    <section class="card"><h3 class="h3">Reading</h3>
      ${choice("font", Object.entries(L.font).map(([v, l]) => [v, l, fonts[v]]), "Font")}
      ${choice("spacing", Object.entries(L.spacing), "Space between letters, words and lines")}
      ${tog("plain", "Plain text style", "No italics, no ALL CAPS, no stretched letters. Everything left-aligned.")}
      ${A.canSpeak() ? tog("readAloud", "Read-aloud buttons", "A 🔊 button on every exercise and stretch reads the instructions out loud.") : ""}</section>
    <section class="card"><h3 class="h3">Hearing</h3>
      ${tog("flash", "Flash the screen for timers", "A gentle color pulse on 3, 2, 1, GO and when time is up, with the word in big letters. One pulse at a time, never strobing.")}
      ${a.flash ? `<button type="button" class="btn small" data-act="a11yTestFlash">Show me</button>` : ""}
      ${tog("captions", "Captioned videos", "Form-video links only look for videos with captions (CC).")}
      ${tog("vibrate", "Vibrate with timers", "Buzzes on the countdown and when time is up. Works on Android; iPhone web apps can't vibrate.")}
      <p class="small muted">Every sound in the app also shows on screen. Timers always show the countdown and "Done".</p></section>
    <section class="card"><h3 class="h3">Screen readers &amp; voice</h3>
      ${A.canSpeak() ? tog("speak", "Talk me through timers", "Says 3, 2, 1, go, halfway, 10 seconds, and time's up.") : ""}
      ${a.speak && A.canSpeak() ? `<button type="button" class="btn small" data-act="a11yTestSpeak">Test the voice</button>` : ""}
      <p class="small muted">Works with VoiceOver and TalkBack. Every button is labeled, charts have a table version, the calendar reads out who trained each day, and timers announce the countdown without chattering every second.</p></section>
    <section class="card"><h3 class="h3">Focus &amp; memory</h3>
      ${tog("focusMode", "One step at a time", "The Workout tab shows just the current step (warm-up, cardio, each exercise, check-in) with Back and Next. Saving moves you on.")}
      ${tog("autoRest", "Start the rest timer when I check off a set", "So you don't have to remember to.")}
      ${choice("toastTime", Object.entries(L.toastTime), "Pop-up messages stay for")}
      ${tog("calm", "Calm mode", "No confetti, no celebration sounds or buzzing. Timers still beep.")}</section>
    <section class="card"><h3 class="h3">Motion</h3>
      ${choice("motion", Object.entries(L.motion), "Animation")}
      <p class="small muted">Nothing in the app ever flashes more than once a second.</p></section>
    <section class="card"><h3 class="h3">Our promise</h3>
      <p class="small">We aim for WCAG 2.2 AA everywhere and go past it where we can. You can zoom up to 500%, use a keyboard or switch control, and nothing has a time limit you can't turn off. If anything is hard to use, tell us and we'll fix it.</p></section>
  </div></div>`;
}

// ---------------------------------------------------------------- calendar & badges & points
function progCalendar() {
  const ids = profileIds(); const m = state.calMonth || TODAY().slice(0, 7);
  const [y, mo] = m.split("-").map(Number); const first = new Date(y, mo - 1, 1);
  const start = S.addDays(S.ymd(first), -((first.getDay() + 6) % 7));
  const byDate = {}; for (const s of state.data.sessions) if ((s.exercises || []).some(e => e.sets?.length)) (byDate[s.date] ||= new Set()).add(s.user);
  const commute = new Set(state.data.activities.filter(a => a.type === "Bike commute").map(a => `${a.user}|${a.date}`));
  const cells = Array.from({ length: 42 }, (_, i) => S.addDays(start, i));
  const prev = S.ymd(new Date(y, mo - 2, 1)).slice(0, 7), next = S.ymd(new Date(y, mo, 1)).slice(0, 7);
  return `<section class="card">
    <div class="between"><button class="btn small" data-act="calMonth" data-v="${prev}">‹</button><h3 class="h3">${first.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h3><button class="btn small" data-act="calMonth" data-v="${next}">›</button></div>
    <div class="cal">${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(d => `<div class="dow" aria-hidden="true">${d[0]}</div>`).join("")}
      ${cells.map(d => { const who = ids.filter(id => byDate[d]?.has(id)); const bike = ids.filter(id => commute.has(`${id}|${d}`));
        const said = `${S.fmtDate(d)}${d === TODAY() ? ", today" : ""}: ${who.length ? who.map(id => P(id).name).join(" and ") + " worked out" : "no workouts"}${bike.length ? ", bike commute" : ""}.`;
        return `<div class="d ${d.slice(0, 7) !== m ? "out" : ""} ${d === TODAY() ? "today" : ""}"><span aria-hidden="true">${+d.slice(8)}</span><span class="visually-hidden">${esc(said)}</span><div class="dots" aria-hidden="true">${who.map(id => `<i style="background:${esc(P(id).color)}" data-i="${esc((P(id).name || "?")[0].toUpperCase())}"></i>`).join("")}${bike.length ? `<i class="bike">🚲</i>` : ""}</div></div>`; }).join("")}</div>
    <div class="row small" aria-hidden="true">${ids.map(id => `<span><i class="cal-key" style="background:${esc(P(id).color)}" data-i="${esc((P(id).name || "?")[0].toUpperCase())}"></i> ${esc(P(id).name)}</span>`).join("")}</div>
  </section>
  <section class="card"><h3 class="h3">Streaks</h3><p class="small muted">A streak week has 3 or more workouts.</p>
    ${ids.map(id => { const st = F.streaks(state.data.sessions, id, TODAY()); return `<div class="list-item"><span>${avatarHtml(id)}${esc(P(id).name)}</span><span class="small mono">🔥 ${st.current} now · best ${st.longest} · ${st.days} workouts</span></div>`; }).join("")}</section>`;
}
function progBadges() {
  const u = state.viewUser; const got = F.earnedBadges(state.data.sessions, state.data.body, state.data.activities, u, TODAY());
  return `<section class="card"><h3 class="h3">${esc(P(u).name)}'s badges · ${got.size}/${F.BADGES.length}</h3>
    <div class="badges">${F.BADGES.map(b => `<div class="badge ${got.has(b.id) ? "" : "locked"}"><span class="i">${b.icon}</span><b>${esc(b.name)}</b><small>${esc(b.desc)}</small></div>`).join("")}</div></section>`;
}
function progPoints() {
  const ids = profileIds(); const mon = S.mondayOf(TODAY());
  const rows = ids.map(id => ({ id, wk: F.points(state.data.sessions, state.data.activities, id, mon, TODAY()), all: F.points(state.data.sessions, state.data.activities, id) })).sort((a, b) => b.wk - a.wk);
  return `<section class="card"><h3 class="h3">This week's leaderboard</h3>
    <p class="small muted">Points: 10 per exercise, 15 cardio, 10 bike commute, 5 warm-up, 5 check-in, 20 finished workout, 25 personal best. Resets Monday.</p>
    ${rows.map((r, i) => { const lv = F.level(r.all); return `<div class="list-item"><span>${["🥇", "🥈", "🥉"][i] || ""} ${avatarHtml(r.id)}${esc(P(r.id).name)}<div class="small muted">Level ${lv.i + 1} · ${esc(lv.name)} · ${r.all} total</div></span><b class="mono">${r.wk}</b></div>`; }).join("")}</section>`;
}

// ---------------------------------------------------------------- PROGRESS
function viewProgress() {
  const tab = state.progTab;
  const tabs = [["lifts", "Lifts"], ["focus", "Focus"], ["cardio", "Cardio"], ["pain", "Pain"], ["calendar", "Calendar"], ["badges", "Badges"], ...(funAt("full") ? [["points", "Points"]] : []), ["history", "History"]];
  const fns = { lifts: progLifts, focus: progFocus, cardio: progCardio, pain: progPain, calendar: progCalendar, badges: progBadges, points: progPoints, history: progHistory };
  const body = (fns[tab] || progLifts)();
  return `<section class="card"><div class="between"><h2 class="h2">Progress</h2>${personToggle()}</div>
    ${seg("progTab", tab, tabs, "Section")}</section>${body}`;
}
function loggedKeys(u) {
  const out = new Map();
  for (const s of S.userSessions(state.data.sessions, u)) for (const e of s.exercises || []) if (!e.skipped && e.sets?.length) out.set(`${e.id}|${e.variant || "std"}`, e.name);
  return out;
}
const displayScore = (kind, sets) => kind === "load" ? Math.round(S.bestScore(kind, sets)) : kind === "carry" ? Math.max(...sets.map(s => s.w || 0)) : S.bestScore(kind, sets);
const scoreLabel = kind => ({ load: "Estimated max (lb)", carry: "Heaviest carry (lb)", assist: "Assist used (lb, lower is better)", time: "Longest hold (sec)", bw: "Most reps in a set" })[kind];

function progLifts() {
  const u = state.viewUser; const logged = loggedKeys(u);
  if (!state.progEx || !(logged.has(state.progEx) || ALL_EX[state.progEx.split("|")[0]])) state.progEx = logged.keys().next().value || `${PLAN.A.Mon.ex[0].id}|std`;
  const [id, v] = state.progEx.split("|");
  const h = S.exHistory(state.data.sessions, u, id, v);
  const def = S.defFor(id, v, h[h.length - 1]);
  const loggedOpts = [...logged.entries()].map(([k, n]) => `<option value="${esc(k)}" ${k === state.progEx ? "selected" : ""}>${esc(n)}${k.endsWith("|hard") ? " (harder)" : k.endsWith("|swap") ? " (swap)" : k.includes("|lib:") ? " (library swap)" : ""}</option>`).join("");
  const planOpts = Object.values(ALL_EX).filter(e => !logged.has(`${e.id}|std`)).map(e => `<option value="${e.id}|std" ${`${e.id}|std` === state.progEx ? "selected" : ""}>${esc(e.n)} · ${e.week} ${e.day}</option>`).join("");
  const sug = ALL_EX[id] ? S.suggestion(state.data.sessions, u, id, v) : null;
  let tiles = "", table = "";
  if (h.length) {
    const pb = S.personalBest(state.data.sessions, u, id, v);
    const first = h[0], last = h[h.length - 1];
    const f = displayScore(first.kind, first.sets), l = displayScore(last.kind, last.sets);
    const pct = f ? Math.round(((def.kind === "assist" ? f - l : l - f) / Math.abs(f)) * 100) : null;
    tiles = `<div class="stats">
      <div class="stat"><div class="v">${esc(S.topSetText(pb.kind, pb.db, pb.sets))}</div><div class="l">Best (${S.fmtDate(pb.date)})</div></div>
      <div class="stat"><div class="v">${esc(S.topSetText(last.kind, last.db, last.sets))}</div><div class="l">Latest</div></div>
      <div class="stat"><div class="v">${h.length}</div><div class="l">Times logged</div></div>
      <div class="stat"><div class="v ${pct > 0 ? "good" : pct < 0 ? "bad" : ""}">${pct == null || h.length < 2 ? "—" : (pct > 0 ? "+" : "") + pct + "%"}</div><div class="l">Since first log</div></div></div>`;
    table = `<div class="scroll"><table class="t"><thead><tr><th>Date</th><th>Sets</th><th>Felt</th></tr></thead><tbody>${h.slice().reverse().slice(0, 15).map(e => `<tr><td class="num">${S.fmtDate(e.date)}</td><td>${esc(S.describeSets(e.kind, e.db, e.sets))}</td><td class="num">${e.sets.map(s => DIFF[s.d || 2][0]).join(" ")}</td></tr>`).join("")}</tbody></table></div>`;
  }
  return `<section class="card">
    <label class="field">Exercise<select data-act="progEx">${loggedOpts ? `<optgroup label="Logged">${loggedOpts}</optgroup>` : ""}<optgroup label="Not logged yet">${planOpts}</optgroup></select></label>
    ${sug ? `<div class="pill ${sug.type}">${esc(sug.text)}</div>` : ""}
    ${h.length ? `${tiles}<div class="chart-box"><canvas id="chart-lift"></canvas></div>${table}` : `<p class="muted">No logs for this exercise yet.</p>`}
  </section>`;
}
function progFocus() {
  const u = state.viewUser; const weeks = S.setsByFocus(state.data.sessions, u);
  const keys = Object.keys(weeks).sort().slice(-8);
  const thisWk = weeks[S.mondayOf(TODAY())] || {};
  const groups = ["chest", "shoulders", "arms", "back", "core", "glutes", "legs", "calves"];
  const focus = PROFILES[u].focus;
  return `<section class="card"><h3 class="h3">Sets per focus area, per week</h3>
    <p class="small muted">Counts sets marked Right or Hard. For muscle growth, about 10–20 hard sets per muscle group per week is a common target.</p>
    ${keys.length ? `<div class="chart-box"><canvas id="chart-focus"></canvas></div>` : `<p class="muted">Log a workout to see this.</p>`}
    <table class="t"><thead><tr><th>This week</th><th>Sets</th></tr></thead><tbody>${groups.map(g => `<tr><td>${FOCUS[g]}${focus.includes(g) ? ` <span class="tag new">Focus</span>` : ""}</td><td class="num">${thisWk[g] || 0}</td></tr>`).join("")}</tbody></table>
  </section>`;
}
function progCardio() {
  const u = state.viewUser; const t = TODAY();
  const wk = S.cardioTotals(state.data.sessions, state.data.activities, u, S.addDays(t, -6), t);
  const hr = state.data.body.filter(b => b.user === u && b.restingHr).length;
  return `<section class="card"><h3 class="h3">Last 7 days</h3><div class="stats">
    <div class="stat"><div class="v">${wk.gymMinutes}</div><div class="l">Gym cardio minutes</div></div>
    <div class="stat"><div class="v">${wk.hiit}</div><div class="l">Interval sessions</div></div>
    ${PROFILES[u].commute.enabled || wk.commuteDays ? `<div class="stat"><div class="v">${wk.commuteMiles}</div><div class="l">Commute miles (${wk.commuteDays} days)</div></div>` : ""}
    </div></section>
    <section class="card"><h3 class="h3">Weekly cardio</h3><div class="chart-box"><canvas id="chart-cardio"></canvas></div></section>
    <section class="card"><h3 class="h3">Resting heart rate</h3>${hr ? `<div class="chart-box"><canvas id="chart-hr"></canvas></div>` : `<p class="muted small">Add resting heart rate on the Body tab. Take it first thing in the morning, before getting up. A lower number over months means your heart is getting fitter.</p>`}</section>`;
}
function progPain() {
  const u = state.viewUser; const ss = S.userSessions(state.data.sessions, u).filter(s => s.pain);
  return `<section class="card"><h3 class="h3">Pain over time</h3>${ss.length ? `<div class="chart-box"><canvas id="chart-pain"></canvas></div>` : `<p class="muted">Check-ins show up here.</p>`}
    <p class="small muted">A line trending down means healing. A spike after a certain day points at the exercise to swap. The cycle report lists which exercises you did on high-pain days.</p></section>`;
}
function progHistory() {
  const u = state.viewUser; const ss = S.userSessions(state.data.sessions, u).reverse();
  if (!ss.length) return `<section class="card"><p class="muted">No workouts logged yet.</p></section>`;
  return `<section class="card">${ss.slice(0, 60).map(s => {
    const n = (s.exercises || []).filter(e => !e.skipped && e.sets?.length).length;
    return `<div class="list-item"><div><b>${S.fmtDate(s.date)}</b> · Week ${esc(s.week)} ${esc(s.day)}<div class="small muted">${n} exercises${s.cardio?.done ? ` · ${esc(s.cardio.type)} ${s.cardio.minutes || 0} min` : ""}</div></div>
      <div class="row"><button class="btn small" data-act="openDay" data-id="${s.id}">Open</button><button class="btn small danger" data-act="delSession" data-id="${s.id}">${state.confirmDel === s.id ? "Confirm" : "Delete"}</button></div></div>`;
  }).join("")}</section>`;
}

// ---------------------------------------------------------------- BODY
function viewBody() {
  const u = state.viewUser; const rows = state.data.body.filter(b => b.user === u).sort((a, b) => (a.date < b.date ? 1 : -1));
  const fields = Object.entries(S.BODY_FIELDS);
  const summary = fields.map(([f, m]) => {
    const xs = rows.filter(r => r[f] != null && r[f] !== "").reverse(); if (!xs.length) return "";
    const first = +xs[0][f], last = +xs[xs.length - 1][f], ch = +(last - first).toFixed(1);
    return `<div class="stat"><div class="v">${last}${m.unit ? ` <span class="small">${m.unit}</span>` : ""}</div><div class="l">${esc(m.label)}${xs.length > 1 ? ` · <span class="${S.trendClass(f, ch)}">${ch > 0 ? "+" : ""}${ch} since ${S.fmtDate(xs[0].date)}</span>` : ""}</div></div>`;
  }).join("");
  const charted = fields.filter(([f]) => rows.some(r => r[f] != null && r[f] !== ""));
  if (!charted.find(([f]) => f === state.bodyField) && charted.length) state.bodyField = charted[0][0];
  return `<section class="card"><div class="between"><h2 class="h2">Body</h2>${personToggle()}</div>
    ${summary ? `<div class="stats">${summary}</div>` : `<p class="muted">No entries yet. Add a first one below, as your "before".</p>`}</section>
    ${bodyForm(u)}
    ${charted.length ? `<section class="card"><label class="field">Chart<select data-act="bodyField">${charted.map(([f, m]) => `<option value="${f}" ${f === state.bodyField ? "selected" : ""}>${esc(m.label)}</option>`).join("")}</select></label><div class="chart-box"><canvas id="chart-body"></canvas></div></section>` : ""}
    ${rows.length ? `<section class="card"><h3 class="h3">Entries</h3>${rows.map(r => `<div class="list-item"><div><b>${S.fmtDate(r.date)}</b><div class="small muted">${fields.filter(([f]) => r[f] != null && r[f] !== "").map(([f, m]) => `${esc(m.label)} ${r[f]}${m.unit ? " " + m.unit : ""}`).join(" · ")}</div></div><button class="btn small danger" data-act="delBody" data-id="${r.id}">${state.confirmDel === r.id ? "Confirm" : "Delete"}</button></div>`).join("")}</section>` : ""}`;
}
function bodyForm(u) {
  const fields = Object.entries(S.BODY_FIELDS);
  return `<section class="card" id="body-form"><h3 class="h3">New entry for ${PROFILES[u].name}</h3>
    <label class="field">Date<input type="date" id="body-date" value="${TODAY()}"></label>
    <div class="grid2">${fields.map(([f, m]) => `<label class="field">${esc(m.label)}${m.unit ? ` (${m.unit})` : ""}<input type="number" inputmode="decimal" step="any" data-bf="${f}"></label>`).join("")}</div>
    <details class="more"><summary>How to measure</summary><div class="panel small">
      <p><b>Weight:</b> morning, after the bathroom, before eating. Weigh a few times a week; the app smooths it into a trend.</p>
      <p><b>Waist:</b> tape level around your belly button, relaxed, after breathing out.</p>
      <p><b>Hips / glutes:</b> around the widest part of your butt, feet together.</p>
      <p><b>Chest:</b> around the fullest part, arms relaxed at your sides.</p>
      <p><b>Thigh and upper arm:</b> the widest part, same side every time.</p>
      <p>Measure every two weeks, same time of day. Fill in only what you measured.</p></div></details>
    <button class="btn primary" data-act="saveBody">Save entry</button></section>`;
}

// ---------------------------------------------------------------- REPORT
function viewReport() {
  return `<section class="card"><div class="between"><h2 class="h2">Report</h2>${personToggle()}</div>
    ${seg("repTab", state.repTab, [["cycle", "Cycle report"], ["compare", "Before & after"]], "Report type")}</section>
    ${state.repTab === "cycle" ? repCycle() : repCompare()}`;
}
function cycleList() {
  const cs = cycleStart(); const cur = S.cycleInfo(TODAY(), cs);
  const dates = [...state.data.sessions, ...state.data.body].map(x => x.date).filter(Boolean).sort();
  const firstIdx = dates.length ? Math.min(S.cycleInfo(dates[0], cs).index, cur.index) : cur.index;
  const out = []; for (let i = cur.index; i >= firstIdx; i--) { const start = S.addDays(S.mondayOf(cs), i * 14); out.push({ index: i, start, end: S.addDays(start, 13) }); }
  return out;
}
function repCycle() {
  const u = state.viewUser; const list = cycleList();
  const c = list.find(x => x.index === state.repCycle) || list[0]; state.repCycle = c.index;
  const r = S.cycleReport({ sessions: state.data.sessions, body: state.data.body, activities: state.data.activities, user: u, start: c.start, end: c.end, today: TODAY() });
  const li = (arr, fn) => arr.length ? `<ul>${arr.map(fn).join("")}</ul>` : `<p class="muted small">None.</p>`;
  const tot = r.diff[1] + r.diff[2] + r.diff[3];
  const inProgress = TODAY() < c.end;
  return `<section class="card report">
    <label class="field">Cycle<select data-act="repCycle">${list.map(x => `<option value="${x.index}" ${x.index === c.index ? "selected" : ""}>${S.fmtDate(x.start)} – ${S.fmtDate(x.end)}${x.index === list[0].index ? " (current)" : ""}</option>`).join("")}</select></label>
    <div class="stats">
      <div class="stat"><div class="v">${r.sessions}/${inProgress ? r.soFar : r.planned}</div><div class="l">${inProgress ? `Workout days so far (${r.planned} in cycle)` : "Workout days"}</div></div>
      <div class="stat"><div class="v">${r.cardio.gymMinutes}</div><div class="l">Cardio minutes</div></div>
      <div class="stat"><div class="v">${r.cardio.hiit}</div><div class="l">Interval sessions</div></div>
      ${r.cardio.commuteDays ? `<div class="stat"><div class="v">${r.cardio.commuteMiles}</div><div class="l">Commute miles</div></div>` : ""}
    </div>
    <h3 class="good">Went up</h3>${li(r.up, x => `<li><b>${esc(x.name)}</b>: best before ${esc(x.before)}, now ${esc(x.sets)}</li>`)}
    <h3>Stalled</h3>${li(r.stalled, x => `<li><b>${esc(x.name)}</b>: best before ${esc(x.before)}, latest ${esc(x.sets)}</li>`)}
    ${r.newEx.length ? `<h3>First time logged</h3>${li(r.newEx, x => `<li><b>${esc(x.name)}</b>: ${esc(x.sets)}</li>`)}` : ""}
    <h3 class="bad">What hurt</h3>
    <table class="t"><thead><tr><th>Area</th><th>Average</th><th>Worst</th></tr></thead><tbody>${Object.entries(r.pain).map(([a, v]) => `<tr><td>${PAIN_AREAS[a]}</td><td class="num">${v ? v.avg : "—"}</td><td class="num">${v ? v.max : "—"}</td></tr>`).join("")}</tbody></table>
    ${r.painDays.length ? `<p class="small">Days with pain 4 or higher:</p>${li(r.painDays, d => `<li>${S.fmtDate(d.date)}: ${esc(d.areas.join(", "))}<div class="small muted">${esc(d.exercises.join(", "))}</div></li>`)}` : ""}
    ${Object.keys(r.bodyChange).length ? `<h3>Body changes</h3>${li(Object.entries(r.bodyChange), ([f, v]) => `<li>${esc(S.BODY_FIELDS[f].label)}: ${v.from} → ${v.to} ${S.BODY_FIELDS[f].unit} (<span class="${S.trendClass(f, v.change)}">${v.change > 0 ? "+" : ""}${v.change}</span>)</li>`)}` : ""}
    ${tot ? `<h3>How sets felt</h3><p class="small">${Math.round(r.diff[1] / tot * 100)}% easy · ${Math.round(r.diff[2] / tot * 100)}% just right · ${Math.round(r.diff[3] / tot * 100)}% hard</p>` : ""}
    <h3>Summary to paste to Claude</h3>
    <p class="small muted">Includes every set of every workout in the cycle.</p>
    <pre class="summary" id="summary" tabindex="0" role="region" aria-label="Summary text">${esc(S.reportText(r))}</pre>
    <button class="btn primary" data-act="copySummary">Copy summary</button>
  </section>`;
}
function repCompare() {
  const u = state.viewUser;
  const dates = [...state.data.sessions, ...state.data.body].filter(x => x.user === u).map(x => x.date).sort();
  const a = state.cmpA || dates[0] || TODAY(), b = state.cmpB || TODAY();
  const c = S.compare({ sessions: state.data.sessions, body: state.data.body, activities: state.data.activities, user: u, a, b });
  return `<section class="card">
    <div class="grid2"><label class="field">Before<input type="date" data-act="cmpA" value="${a}"></label><label class="field">After<input type="date" data-act="cmpB" value="${b}"></label></div>
    <p class="small muted">${c.between} workouts between these dates${c.cardio.gymMinutes ? ` · ${c.cardio.gymMinutes} cardio minutes` : ""}${c.cardio.commuteMiles ? ` · ${c.cardio.commuteMiles} commute miles` : ""}.</p>
    <h3 class="h3">Body</h3>
    ${c.bodyRows.length ? `<div class="scroll"><table class="t"><thead><tr><th></th><th>Before</th><th>After</th><th>Change</th></tr></thead><tbody>${c.bodyRows.map(r => `<tr><td>${esc(r.label)}</td><td class="num">${r.a ? r.a.value : "—"}</td><td class="num">${r.b ? r.b.value : "—"}</td><td class="num ${S.trendClass(r.f, r.change)}">${r.change == null ? "—" : (r.change > 0 ? "+" : "") + r.change + " " + r.unit}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted small">No body entries yet.</p>`}
    <h3 class="h3">Lifts (best set up to each date)</h3>
    ${c.lifts.length ? `<div class="scroll"><table class="t"><thead><tr><th>Exercise</th><th>Before</th><th>After</th><th>Change</th></tr></thead><tbody>${c.lifts.map(l => `<tr><td>${esc(l.name)}</td><td>${esc(l.a)}</td><td>${esc(l.b)}</td><td class="num ${l.pct > 0 ? "good" : l.pct < 0 ? "bad" : ""}">${l.pct == null ? "new" : (l.pct > 0 ? "+" : "") + l.pct + "%"}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted small">No lifts logged yet.</p>`}
  </section>`;
}

// ---------------------------------------------------------------- charts
function destroyCharts() { state.charts.forEach(c => c.destroy()); state.charts = []; }
const cssVar = n => getComputedStyle(document.body).getPropertyValue(n).trim();
function chart(id, config) {
  const el = document.getElementById(id); if (!el) return;
  if (!window.Chart) { el.parentElement.innerHTML = `<p class="muted small">Charts need an internet connection the first time the app loads.</p>`; return; }
  Chart.defaults.color = cssVar("--muted"); Chart.defaults.borderColor = cssVar("--line"); Chart.defaults.font.family = cssVar("--body");
  config.options = { animation: A.reduceMotion() ? false : undefined, responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { labels: { boxWidth: 12 } } }, ...config.options };
  state.charts.push(new Chart(el, config));
  A.chartTable(el, config, el.closest("section")?.querySelector("h2, h3")?.textContent?.trim());
}
const PALETTE = () => [cssVar("--mat"), cssVar("--benny"), cssVar("--plate"), cssVar("--warn"), cssVar("--good"), "#8a5a9c", "#4f8fb8", cssVar("--muted")];
const line = (label, data, color, extra = {}) => ({ label, data, borderColor: color, backgroundColor: color, tension: .25, pointRadius: 3, spanGaps: true, ...extra });

function afterRender() {
  const u = state.viewUser;
  if (state.view === "progress") {
    if (state.progTab === "lifts" && state.progEx) {
      const [id, v] = state.progEx.split("|");
      const h = S.exHistory(state.data.sessions, u, id, v); if (!h.length) return;
      const kind = h[h.length - 1].kind;
      const ds = [line(scoreLabel(kind), h.map(e => displayScore(e.kind, e.sets)), cssVar("--accent"))];
      if (kind === "load") ds.push(line("Top weight (lb)", h.map(e => Math.max(...e.sets.map(s => s.w || 0))), cssVar("--plate"), { borderDash: [5, 4] }));
      chart("chart-lift", { type: "line", data: { labels: h.map(e => S.fmtDate(e.date)), datasets: ds }, options: { scales: { y: { reverse: kind === "assist" } } } });
    }
    if (state.progTab === "focus") {
      const weeks = S.setsByFocus(state.data.sessions, u); const keys = Object.keys(weeks).sort().slice(-8);
      const groups = ["chest", "shoulders", "arms", "back", "core", "glutes", "legs", "calves"]; const pal = PALETTE();
      chart("chart-focus", { type: "bar", data: { labels: keys.map(k => S.fmtDate(k)), datasets: groups.map((g, i) => ({ label: FOCUS[g], data: keys.map(k => weeks[k][g] || 0), backgroundColor: pal[i % pal.length] })) }, options: { scales: { x: { stacked: true }, y: { stacked: true, title: { display: true, text: "Sets" } } } } });
    }
    if (state.progTab === "cardio") {
      const t = TODAY(); const wks = Array.from({ length: 8 }, (_, i) => S.addDays(S.mondayOf(t), -7 * (7 - i)));
      const tots = wks.map(w => S.cardioTotals(state.data.sessions, state.data.activities, u, w, S.addDays(w, 6)));
      const ds = [{ type: "bar", label: "Gym cardio (min)", data: tots.map(x => x.gymMinutes), backgroundColor: cssVar("--plate"), yAxisID: "y" }];
      if (tots.some(x => x.commuteMiles)) ds.push({ type: "line", label: "Commute miles", data: tots.map(x => x.commuteMiles), borderColor: cssVar("--accent"), backgroundColor: cssVar("--accent"), yAxisID: "y1", tension: .25 });
      chart("chart-cardio", { type: "bar", data: { labels: wks.map(w => S.fmtDate(w)), datasets: ds }, options: { scales: { y: { beginAtZero: true, title: { display: true, text: "Minutes" } }, y1: { display: ds.length > 1, position: "right", beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: "Miles" } } } } });
      const hr = state.data.body.filter(b => b.user === u && b.restingHr).sort((a, b) => (a.date < b.date ? -1 : 1));
      if (hr.length) chart("chart-hr", { type: "line", data: { labels: hr.map(b => S.fmtDate(b.date)), datasets: [line("Resting heart rate (bpm)", hr.map(b => +b.restingHr), cssVar("--accent"))] } });
    }
    if (state.progTab === "pain") {
      const ss = S.userSessions(state.data.sessions, u).filter(s => s.pain); const pal = PALETTE();
      chart("chart-pain", { type: "line", data: { labels: ss.map(s => S.fmtDate(s.date)), datasets: PROFILES[u].pain.map((a, i) => line(PAIN_AREAS[a], ss.map(s => s.pain[a] ?? null), pal[(i + 2) % pal.length])) }, options: { scales: { y: { min: 0, max: 10 } } } });
    }
  }
  if (state.view === "body") {
    const f = state.bodyField; const xs = state.data.body.filter(b => b.user === u && b[f] != null && b[f] !== "").sort((a, b) => (a.date < b.date ? -1 : 1));
    if (xs.length) {
      const vals = xs.map(b => +b[f]); const ds = [line(S.BODY_FIELDS[f].label, vals, cssVar("--accent"))];
      if (f === "weight" && xs.length > 2) ds.push(line("Trend (7-entry average)", S.movingAvg(vals), cssVar("--plate"), { pointRadius: 0, borderDash: [5, 4] }));
      chart("chart-body", { type: "line", data: { labels: xs.map(b => S.fmtDate(b.date)), datasets: ds } });
    }
  }
}

// ---------------------------------------------------------------- overlays: rest timer & settings
// The rest timer uses the same engine as every other timer (js/timer.js): 3-2-1-go, then 5 beeps.
function openTimer(exId) {
  const ex = ALL_EX[exId] || resolveEx(exId, {});
  state.overlay = "timer";
  state.timer = { ex, total: store.get("twp-rest", 90) };
  drawTimer();
}
function drawTimer() {
  const t = state.timer; if (!t) return;
  $("#overlay").innerHTML = `<div class="overlay" role="dialog" aria-label="Rest timer"><div class="inner">
    <div class="between"><span class="eyebrow">Rest · ${esc(t.ex?.n || "")}</span><button class="btn small" data-act="closeOverlay">Close</button></div>
    <div class="rest-tmr">${T.html("rest", t.total)}</div>
    <div class="row" style="justify-content:center">${[60, 90, 120].map(n => `<button class="btn small" data-act="timerSet" data-n="${n}" aria-pressed="${t.total === n}">${n}s</button>`).join("")}
      <button class="btn small" data-act="timerAdd" data-n="-15">−15</button><button class="btn small" data-act="timerAdd" data-n="15">+15</button></div>
    ${t.ex?.s?.length ? `<h3 class="h3">Stretch while you wait</h3>${t.ex.s.map(stretchBox).join("")}` : ""}
  </div></div>`;
}
function closeOverlay() { T.stop("rest"); state.timer = null; state.overlay = null; $("#overlay").innerHTML = ""; }

function exportData() {
  const data = { app: "two-week-split", exportedAt: new Date().toISOString(), ...state.data };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `two-week-split-backup-${TODAY()}.json`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// ---------------------------------------------------------------- saving
function cardFor(el) {
  const card = el.closest("[data-ex]"); if (!card) return null;
  const u = LU(), date = LD(), id = card.dataset.ex;
  const item = todaysList(u, date).find(x => x.ex.id === id); if (!item) return null;
  const s = sessionFor(u, date); const logged = s?.exercises?.find(e => e.id === id);
  const d = getDraft(u, date, item.ex, logged);
  const setEl = el.closest("[data-s]");
  return { u, date, id, ex: item.ex, added: item.added, logged, d, si: setEl ? +setEl.dataset.s : null, card };
}
function saveExercise(c) {
  const v = c.d.variant;
  const def = defOf(c.ex, v);
  const sets = c.d.sets.map(s => ({ w: +s.w || 0, r: +s.r || 0, d: +s.d || 2 })).filter(s => s.r > 0 || s.w > 0);
  if (!sets.length) { toast("Add at least one set first."); return; }
  if (def.kind === "load" || def.kind === "carry") { const i = sets.findIndex(s => !s.w); if (i >= 0) { toast(`Set ${i + 1} has no weight. Fill it in or remove that set.`); return; } }
  const entry = { id: c.id, variant: v, name: def.name, kind: def.kind, db: !!def.db, sets, ...(c.added ? { added: true } : {}), ...(def.focus ? { focus: def.focus } : {}) };
  const s = sessionFor(c.u, c.date);
  const prev = S.personalBest(state.data.sessions.filter(x => x.date < c.date), c.u, c.id, v);
  const isPR = prev && S.betterThan(def.kind, S.bestScore(def.kind, sets), prev.score);
  const planOrder = todaysList(c.u, c.date).map(x => x.ex.id);
  entry.order = planOrder.indexOf(c.id) >= 0 ? planOrder.indexOf(c.id) : 100 + planOrder.length;
  writeSession(c.u, c.date, { ex: { [c.id]: entry }, ...(!s?.startedAt && c.date === TODAY() ? { startedAt: Date.now() } : {}) });
  store.del(dKey(c.u, c.date, c.id));
  store.set(xKey(c.u, c.date), getExtras(c.u, c.date).filter(x => x.id !== c.id));
  state.editing.delete(editKey(c.u, c.date, c.id));
  const voice = P(state.user).voice;
  if (isPR) celebrate("pr", F.say(voice, "pr", { name: def.name }));
  else celebrate("save", F.say(voice, "saveEx", { name: def.name }));
}
function saveCardio(skip) {
  const u = LU(), date = LD(); const form = $("#cardio-form");
  const val = k => form.querySelector(`[data-cf="${k}"]`);
  const c = skip ? { skipped: "commute", done: false, type: "", minutes: 0, miles: null, avgHr: null, hiit: false } : {
    done: true, skipped: null, type: val("type").value, minutes: +val("minutes").value || 0,
    miles: val("miles").value === "" ? null : +val("miles").value, avgHr: val("avgHr").value === "" ? null : +val("avgHr").value, hiit: val("hiit").checked
  };
  writeSession(u, date, { cardio: c });
  if (PROFILES[u].commute.enabled) {
    const cid = `${u}-${date}-commute`; const on = skip || val("commute")?.checked;
    if (on) save("activities", cid, { user: u, date, type: "Bike commute", miles: +(val("commuteMiles")?.value || PROFILES[u].commute.miles) || 0 });
    else if (state.data.activities.find(a => a.id === cid)) remove("activities", cid);
  }
  store.del(`twp-c-${u}-${date}`); state.editing.delete(editKey(u, date, "cardio"));
  toast(skip ? "Logged your bike commute." : "Saved cardio.");
}
function saveCheckin() {
  const u = LU(), date = LD(); const k = store.get(`twp-k-${u}-${date}`, null);
  const form = $("#checkin-form");
  const pain = {}; form.querySelectorAll("[data-kf^='pain.']").forEach(i => { pain[i.dataset.kf.slice(5)] = +i.value || 0; });
  const recovery = k?.recovery || sessionFor(u, date)?.recovery || { sleep: 0, energy: 0, soreness: 0 };
  writeSession(u, date, { pain, recovery, notes: form.querySelector("[data-kf=notes]").value, checkin: true });
  store.del(`twp-k-${u}-${date}`); state.editing.delete(editKey(u, date, "checkin"));
  toast("Saved check-in.");
}
function checkinDraft() {
  const u = LU(), date = LD(); const s = sessionFor(u, date);
  return store.get(`twp-k-${u}-${date}`, null) || { pain: { ...(s?.pain || {}) }, recovery: { sleep: 0, energy: 0, soreness: 0, ...(s?.recovery || {}) }, notes: s?.notes || "" };
}

// Changing a set also changes the sets after it that had the same value, so set 1 fills the rest.
function setValue(c, f, val, typingIn) {
  const old = c.d.sets[c.si][f];
  c.d.sets.forEach((s, j) => {
    if (j === c.si || (j > c.si && s[f] === old)) {
      s[f] = val;
      const input = c.card.querySelector(`.set[data-s="${j}"] input[data-f="${f}"]`);
      if (input && input !== typingIn) input.value = val;
    }
  });
  c.d.fresh = false; putDraft(c.u, c.date, c.id, c.d);
  c.card.querySelector(".fresh-note")?.remove();
  T.syncCard(c.card);
}

// ---------------------------------------------------------------- events
function go(view) {
  state.view = view; state.confirmDel = null; store.set("twp-view", view); render(); scrollTo(0, 0);
  const h = $("#main h2, #main h1, #main h3"); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  A.announce(`${VIEW_NAMES[view]} tab`);
}

document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const act = el.dataset.act; const v = el.dataset.v;
  switch (act) {
    case "newProfile": openProfileForm(null); break;
    case "editProfile": openProfileForm(state.user); break;
    case "pfToggle": { const f = state.profForm[el.dataset.k]; const i = f.indexOf(el.dataset.v); i >= 0 ? f.splice(i, 1) : f.push(el.dataset.v); el.setAttribute("aria-pressed", i < 0); break; }
    case "pfOne": state.profForm[el.dataset.k] = el.dataset.v; el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b === el)); break;
    case "pfAvatar": state.profForm.avatar = el.dataset.v; el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b === el)); break;
    case "pfSave": saveProfileForm(); break;
    case "pfArchive": { if (state.confirmDel !== "pf") { state.confirmDel = "pf"; drawProfileForm(P(state.profForm.id)); break; } state.confirmDel = null; saveProfile(state.profForm.id, { archived: true }); if (state.user === state.profForm.id) { state.user = null; store.del("twp-user"); } closeOverlay(); render(); break; }
    case "pickPartner": state.partnerId = v; store.set("twp-partner-id", v); openSettings(); render(); break;
    case "setTheme": saveProfile(state.user, { theme: v }); setTimeout(() => { applyAppearance(); openSettings(); render(); }, 60); break;
    case "resetAccent": saveProfile(state.user, { accent: "" }); setTimeout(() => { applyAppearance(); openSettings(); render(); }, 60); break;
    case "setText": setA11y({ textSize: v }); openSettings(); break;
    case "openA11y": openA11y(); break;
    case "a11ySet": { const k = el.dataset.k; const cur = A.DEFAULTS[k]; setA11y({ [k]: typeof cur === "number" ? +v : v }); A.announce(`${el.textContent} selected`); break; }
    case "a11yPreset": setA11y(A.applyPreset(v)); A.announce(`${A.PRESETS[v].label} options turned on`); toast(`${A.PRESETS[v].label} options are on.`); break;
    case "a11yReset": A.reset(); setA11y({}); A.announce("Accessibility options reset"); break;
    case "a11yTestSpeak": A.readAloud("3. 2. 1. Go. This is how timers will sound."); break;
    case "a11yTestFlash": A.flash("GO", true); break;
    case "setVoice": saveProfile(state.user, { voice: v }); setTimeout(openSettings, 60); toast(F.say(v, "saveEx", { name: "Sample" })); break;
    case "setFun": saveProfile(state.user, { fun: v }); setTimeout(() => { openSettings(); render(); }, 60); break;
    case "goView": go(v); break;
    case "dismissRem": { const k = `twp-rem-${LU()}-${TODAY()}`; store.set(k, [...store.get(k, []), v]); render(); break; }
    case "startDeload": save("settings", `deload_${LU()}`, { from: TODAY(), to: S.addDays(TODAY(), 6) }); toast("Lighter week on. New exercises you open will be pre-filled lighter."); break;
    case "endDeload": save("settings", `deload_${LU()}`, { from: deloadOf(LU()).from, to: S.addDays(TODAY(), -1) }); toast("Lighter week ended."); break;
    case "warmupDone": focusSaved(); writeSession(LU(), LD(), { warmup: true, ...(!sessionFor(LU(), LD())?.startedAt && LD() === TODAY() ? { startedAt: Date.now() } : {}) }); celebrate("quiet", F.say(P(state.user).voice, "saveEx", { name: "Warm-up" })); render(); break;
    case "undoWarmup": writeSession(LU(), LD(), { warmup: false }); render(); break;
    case "startWorkout": F.unlockAudio(); writeSession(LU(), LD(), { startedAt: Date.now() }); toast(F.say(P(state.user).voice, "start")); render(); break;
    case "finishWorkout": { writeSession(LU(), LD(), { finishedAt: Date.now() }); const u = LU(), d = LD(); setTimeout(() => { openSummary(u, d); celebrate("finish"); }, 120); break; }
    case "showSummary": openSummary(LU(), LD()); break;
    case "hi5": { const to = other(LU()); save("pings", `to_${to}`, { from: LU(), to, at: Date.now() }); const b = document.createElement("div"); b.className = "hi5-burst"; b.textContent = "🙌"; document.body.appendChild(b); setTimeout(() => b.remove(), 1400); toast(F.say(P(state.user).voice, "hi5sent", { name: P(to).name })); break; }
    case "calMonth": state.calMonth = v; render(); break;
    case "planMove": {
      const c = cardFor(el); const { week, day } = state.sel;
      const ids = todaysList(c.u, c.date).filter(x => !x.added).map(x => x.ex.id); const i = ids.indexOf(c.id), j = i + +v;
      if (i < 0 || j < 0 || j >= ids.length) break; [ids[i], ids[j]] = [ids[j], ids[i]];
      editPlan([c.u], [week], day, d => { d.order = ids; }); break;
    }
    case "planClear": {
      if (state.confirmDel !== "planClear") { state.confirmDel = "planClear"; render(); break; }
      state.confirmDel = null; const { week, day } = state.sel; const u = LU();
      editPlan([u], [week], day, d => { d.remove = PLAN[week][day].ex.map(e => e.id); d.add = []; d.order = []; }); toast("Day cleared. Add exercises from the library."); break;
    }
    case "planReset": {
      if (state.confirmDel !== "planReset") { state.confirmDel = "planReset"; render(); break; }
      state.confirmDel = null; const { week, day } = state.sel;
      editPlan([LU()], [week], day, d => { Object.assign(d, { add: [], remove: [], order: [], sr: {}, title: "" }); }); toast("Back to the original plan for this day."); break;
    }
    case "planCopy": { const { week, day } = state.sel; const src = dayEdits(LU(), week, day); const to = other(LU()); editPlan([to], [week], day, d => { Object.assign(d, JSON.parse(JSON.stringify(src))); }); toast(`Copied to ${P(to).name}'s plan.`); break; }
    case "authGoogle": busy(() => signInGoogle()); break;
    case "authMode": state.auth.mode = state.auth.mode === "create" ? "signin" : "create"; state.auth.error = ""; render(); break;
    case "authReset": { const em = $("#au-email")?.value.trim(); if (!em) { state.auth.error = "Type your email above first, then tap Forgot password."; render(); break; }
      busy(async () => { await resetPassword(em); state.auth.notice = `Password reset email sent to ${em}. Check your spam folder too.`; }); break; }
    case "authResetMe": resetPassword(state.auth.user.email).then(() => toast("Password reset email sent."), e => toast(e.message)); break;
    case "authSignOut": {
      Object.keys(localStorage).filter(k => k.startsWith("twp-")).forEach(k => store.del(k));
      closeOverlay(); stopAll(); state.user = null;
      signOutAndClear().finally(() => location.reload()); break;
    }
    case "crewJoin": { const code = $("#crew-code").value; const u = state.auth.user; busy(async () => { const id = await joinCrew(code, { uid: u.uid, name: u.name || u.email.split("@")[0], email: u.email }); startCrew(id); }); break; }
    case "crewCreate": { const name = $("#crew-name").value.trim() || "Our crew"; const u = state.auth.user; busy(async () => { const r = await createCrew(name, { uid: u.uid, name: u.name || u.email.split("@")[0], email: u.email, profileId: state.user || "" }); startCrew(r.id); }); break; }
    case "copyCode": { const c = state.auth.crew?.code || ""; navigator.clipboard?.writeText(c).then(() => toast("Invite code copied."), () => toast(c)); break; }
    case "newCode": newInviteCode(state.auth.crewId, state.auth.crew?.code).then(c => { toast(`New code: ${c}. The old one no longer works.`); openSettings(); }, e => toast(e.message)); break;
    case "crewRemove": { const uid = el.dataset.v; if (state.confirmDel !== uid) { state.confirmDel = uid; openSettings(); break; } state.confirmDel = null; removeMember(state.auth.crewId, uid).then(() => { toast("Removed from the crew."); openSettings(); }, e => toast(e.message)); break; }
    case "legacyQuick": readLegacy().then(r => r.count ? importAll(r.data).then(n => toast(`Copied ${n} item${n === 1 ? "" : "s"} into the crew.`)) : toast("No old data found. Is the TEMPORARY rule still published?"), e => toast(e.message)); break;
    case "legacyCheck": readLegacy().then(r => { state.auth.legacy = r; if (!r.count) toast("No old data found (or the temporary rule isn't published)."); openSettings(); }); break;
    case "legacyCopy": { const r = state.auth.legacy; importAll(r.data).then(n => { toast(`Copied ${n} item${n === 1 ? "" : "s"} into the crew.`); state.auth.legacy = null; openSettings(); }, e => toast(e.message)); break; }
    case "linkGoogle": addGoogle().then(() => { state.auth.user = currentInfo(); toast("Google sign-in added."); openSettings(); }, e => toast(e.message)); break;
    case "linkPassword": { const pw = $("#link-pw").value; if (pw.length < 6) { toast("Use at least 6 characters."); break; } addPassword(pw).then(() => { state.auth.user = currentInfo(); toast("Password added."); openSettings(); }, e => toast(e.message)); break; }
    case "pickUser": if (state.auth.crewId && state.auth.user && (!me()?.profileId || me()?.profileId !== el.dataset.u) && !state.partner) updateMember(state.auth.crewId, state.auth.user.uid, { profileId: el.dataset.u }).catch(() => {});
      state.user = el.dataset.u; state.viewUser = state.user; state.logUser = state.user; state.sel = null; store.set("twp-user", state.user); if (state.overlay) closeOverlay(); render(); break;
    case "logUser": state.logUser = el.dataset.u; render(); break;
    case "selWeek": state.sel.week = v; state.userTouchedSel = true; render(); break;
    case "selDay": state.sel.day = v; state.userTouchedSel = true; render(); break;
    case "backToToday": state.logDate = null; state.sel = null; state.userTouchedSel = false; render(); break;
    case "variant": {
      const c = cardFor(el);
      if (v === "lib") { openLibSwap(c.id); break; }
      if (v !== "swap") { state.variants[`${c.u}:${c.id}`] = v; store.set("twp-variants", state.variants); }
      const def = defOf(c.ex, v); const p = prefillSets(c.u, { sr: def.sr, kind: def.kind }, c.id, v);
      putDraft(c.u, c.date, c.id, { variant: v, ...p }); render(); break;
    }
    case "timer": { const c = cardFor(el); openTimer(c ? c.id : el.dataset.ex); break; }
    case "step": {
      const c = cardFor(el); const f = el.dataset.f; const old = +c.d.sets[c.si][f] || 0; const dir = Math.sign(+el.dataset.by);
      const def = defOf(c.ex, c.d.variant); const by = f === "w" ? stepFor(def.db, def.kind, old, dir) * dir : +el.dataset.by;
      setValue(c, f, Math.max(0, +(old + by).toFixed(2))); break;
    }
    case "diff": {
      const c = cardFor(el); c.d.sets[c.si].d = +el.dataset.d; c.d.fresh = false; putDraft(c.u, c.date, c.id, c.d);
      el.parentElement.querySelectorAll("[data-d]").forEach(b => b.setAttribute("aria-pressed", b === el)); c.card.querySelector(".fresh-note")?.remove(); break;
    }
    case "focusGo": { const n = +el.dataset.n; if (n >= 0 && n < (state.focusCount || 99)) { state.focusStep = n; render(); scrollTo(0, 0); const h = $("#main .focus-head + * .name, #main .focus-head + * summary, #main .focus-head + * h3"); h?.setAttribute("tabindex", "-1"); h?.focus({ preventScroll: true }); A.announce(`Step ${n + 1}`); } break; }
    case "focusAll": state.focusAll = true; render(); break;
    case "focusBack": state.focusAll = false; state.focusStep = null; render(); break;
    case "readEx": {
      const c = cardFor(el); const v = c.d.variant; const def = defOf(c.ex, v);
      const how = v === "hard" && c.ex.h ? c.ex.h.how : v === "swap" && c.ex.swap ? c.ex.swap.how : [c.ex.why, c.ex.setup].filter(Boolean).join(" ");
      A.readAloud(`${def.name}. ${srFor(c.u, c.ex, def) || ""}. ${how}`.replace(/×/g, " by ").replace(/–/g, " to ")); break;
    }
    case "readStretch": { const st = STRETCH[v]; if (st) A.readAloud(`${st.n}. ${st.t}. ${st.h} Where you should feel it: ${st.f} What it does: ${st.g}`.replace(/–/g, " to ")); break; }
    case "setDone": {
      const c = cardFor(el); const set = c.d.sets[c.si]; set.done = !set.done; putDraft(c.u, c.date, c.id, c.d);
      if (set.done) { A.buzz(30); A.announce(`Set ${c.si + 1} checked off. ${c.d.sets.filter(x => x.done).length} of ${c.d.sets.length} done.`); } else A.announce(`Set ${c.si + 1} unchecked.`);
      if (set.done && A.get().autoRest && defOf(c.ex, c.d.variant).kind !== "time" && c.d.sets.some(x => !x.done)) { openTimer(c.id); T.start("rest", state.timer.total, "Rest"); }
      if (defOf(c.ex, c.d.variant).kind === "time") { T.stop(`set:${c.u}|${c.date}|${c.id}|${c.si}`); render(); break; }
      el.setAttribute("aria-checked", set.done); el.textContent = set.done ? "✓" : c.si + 1; el.closest(".set").classList.toggle("is-done", set.done);
      c.card.querySelector("[data-act=saveEx]")?.classList.toggle("ready", c.d.sets.every(x => x.done)); break;
    }
    case "delSet": { const c = cardFor(el); c.d.sets.splice(c.si, 1); putDraft(c.u, c.date, c.id, c.d); render(); break; }
    case "addSet": { const c = cardFor(el); c.d.sets.push({ ...(c.d.sets[c.d.sets.length - 1] || { w: 0, r: 10 }), d: 2, done: false }); putDraft(c.u, c.date, c.id, c.d); render(); break; }
    case "saveEx": { const c = cardFor(el); saveExercise(c); focusSaved(); render(); break; }
    case "editEx": { const u = LU(), date = LD(); state.editing.add(editKey(u, date, el.dataset.ex)); render(); break; }
    case "cancelEdit": { const c = cardFor(el); store.del(dKey(c.u, c.date, c.id)); state.editing.delete(editKey(c.u, c.date, c.id)); render(); break; }
    case "deleteEx": {
      const c = cardFor(el); const k = editKey(c.u, c.date, c.id);
      if (state.confirmDel !== k) { state.confirmDel = k; render(); break; }
      state.confirmDel = null; const s = sessionFor(c.u, c.date);
      if (s?.ex?.[c.id]) dropField("sessions", s.id, ["ex", c.id]);
      const raw = state.raw.sessions?.find(x => x.id === s?.id);
      if (raw?.exercises?.some(x => x.id === c.id)) patch("sessions", s.id, { exercises: raw.exercises.filter(x => x.id !== c.id) });
      store.del(dKey(c.u, c.date, c.id)); state.editing.delete(k); toast("Removed."); render(); break;
    }
    case "dropExtra": { const c = cardFor(el); store.set(xKey(c.u, c.date), getExtras(c.u, c.date).filter(x => x.id !== c.id)); store.del(dKey(c.u, c.date, c.id)); render(); break; }
    case "openPicker": openPicker(); break;
    case "libSwap": { const c = cardFor(el); openLibSwap(c.id); break; }
    case "libShowAll": state.libSwapAll = true; drawLibSwap(); break;
    case "pickLibSwap": {
      const { u, date, id } = state.libSwapFor; const item = todaysList(u, date).find(x => x.ex.id === id); if (!item) break;
      const v = `lib:${el.dataset.id}`; const def = defOf(item.ex, v);
      putDraft(u, date, id, { variant: v, ...prefillSets(u, { sr: def.sr, kind: def.kind }, id, v) });
      closeOverlay(); render(); setTimeout(() => document.getElementById(`ex-${id}`)?.scrollIntoView({ block: "center" }), 50); break;
    }
    case "libF": { state.libF[el.dataset.k] = el.dataset.v; store.set("twp-libf", state.libF); render(); break; }
    case "libFocus": el.setAttribute("aria-pressed", el.getAttribute("aria-pressed") !== "true"); break;
    case "ache": {
      const u = state.viewUser; const a = new Set(aches(u)); a.has(el.dataset.v) ? a.delete(el.dataset.v) : a.add(el.dataset.v);
      save("settings", `aches_${u}`, { areas: [...a] }); break;
    }
    case "libNew": state.libEdit = "new"; render(); setTimeout(() => $("#lib-form")?.scrollIntoView({ block: "start" }), 30); break;
    case "libSave": saveLibrary(); break;
    case "libEdit": state.libEdit = el.dataset.id; render(); setTimeout(() => $("#lib-form")?.scrollIntoView({ block: "start" }), 30); break;
    case "libCancel": state.libEdit = null; render(); break;
    case "libDelete": {
      const id = el.dataset.id; const m = libItem(id);
      if (state.confirmDel !== id) { state.confirmDel = id; render(); break; }
      state.confirmDel = null; state.libEdit = null;
      if (m?.builtin) save("library", id, { hidden: true }); else remove("library", id);
      toast(m?.builtin ? "Hidden. Restore it from the bottom of the Gym tab." : "Deleted."); break;
    }
    case "libRestore": remove("library", el.dataset.id); toast("Restored."); break;
    case "libQuick": { const ex = ALL_EX[el.dataset.id]; save("library", slug(ex.n), { name: ex.n, focus: ex.focus.filter(f => GROUPS.includes(f)), equip: guessEquip(ex.n), pattern: PLAN_PATTERN[ex.id] || "", kind: ex.kind, db: ex.db, sr: ex.sr, how: ex.setup, notes: "" }); toast(`Added ${ex.n}.`); break; }
    case "libToday": { const m = libItem(el.dataset.id); addExtra({ id: `lib-${m.id}`, name: m.name, kind: m.kind || "load", db: !!m.db, focus: m.focus || [] }); state.view = "today"; store.set("twp-view", "today"); render(); break; }
    case "libPlan": openAddPlan(el.dataset.id); break;
    case "apSet": state.addPlan[el.dataset.k] = el.dataset.v; drawAddPlan(); break;
    case "apSave": saveAddPlan(); break;
    case "apCancel": state.addPlan = null; render(); break;
    case "planEdit": state.planEdit = !state.planEdit; render(); break;
    case "planRemove": {
      const c = cardFor(el); const { week, day } = state.sel;
      editPlan([c.u], [week], day, d => { if (c.id.startsWith("lib-") && d.add.includes(c.id)) d.add = d.add.filter(x => x !== c.id); else if (!d.remove.includes(c.id)) d.remove.push(c.id); });
      toast(`Removed from ${PROFILES[c.u].name}'s plan.`); break;
    }
    case "planRestore": { const { week, day } = state.sel; editPlan([LU()], [week], day, d => { d.remove = d.remove.filter(x => x !== el.dataset.id); }); break; }
    case "planFromLib": state.addPlan = { who: LU(), week: state.sel.week, day: state.sel.day }; go("gym"); toast("Tap Add to plan on any exercise."); break;
    case "pickLib": { const m = libItem(el.dataset.id); if (m) addExtra({ id: `lib-${m.id}`, name: m.name, kind: m.kind || "load", db: !!m.db, focus: m.focus || [] }); break; }
    case "pickEx": { const ex = ALL_EX[el.dataset.id]; if (ex) addExtra({ id: ex.id, name: ex.n, kind: ex.kind, db: ex.db }); else { const found = state.data.sessions.flatMap(s => s.exercises || []).find(x => x.id === el.dataset.id); if (found) addExtra({ id: found.id, name: found.name, kind: found.kind, db: !!found.db }); } break; }
    case "addCustom": {
      const name = $("#cx-name").value.trim(); if (!name) { toast("Give it a name first."); break; }
      const kind = $("#cx-kind").value, db = $("#cx-db").checked;
      if ($("#cx-lib").checked) {
        const focus = [...document.querySelectorAll("#cx-focus [aria-pressed=true]")].map(b => b.dataset.v);
        save("library", slug(name), { name, focus, equip: guessEquip(name), pattern: "", kind, db, notes: "", sr: "3 × 10" });
        addExtra({ id: `lib-${slug(name)}`, name, kind, db, focus });
      } else addExtra({ id: `custom-${slug(name)}`, name, kind, db });
      break;
    }
    case "saveCardio": saveCardio(false); focusSaved(); render(); break;
    case "skipCardio": saveCardio(true); focusSaved(); render(); break;
    case "editCardio": state.editing.add(editKey(LU(), LD(), "cardio")); render(); break;
    case "editCheckin": state.editing.add(editKey(LU(), LD(), "checkin")); render(); break;
    case "scale": {
      const k = checkinDraft(); k.recovery[el.dataset.k] = +el.dataset.n; store.set(`twp-k-${LU()}-${LD()}`, k);
      el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b === el)); break;
    }
    case "saveCheckin": saveCheckin(); focusSaved(); render(); break;
    case "viewUser": state.viewUser = el.dataset.u; state.confirmDel = null; render(); break;
    case "progTab": state.progTab = v; render(); break;
    case "repTab": state.repTab = v; render(); break;
    case "openDay": {
      const s = state.data.sessions.find(x => x.id === el.dataset.id); if (!s) break;
      if (s.user !== state.user) { state.partner = true; store.set("twp-partner", true); }
      state.logUser = s.user; state.logDate = s.date === TODAY() ? null : s.date; state.sel = { week: s.week, day: s.day }; state.userTouchedSel = true;
      go("today"); break;
    }
    case "delSession": {
      if (state.confirmDel !== el.dataset.id) { state.confirmDel = el.dataset.id; render(); break; }
      remove("sessions", el.dataset.id); state.confirmDel = null; toast("Workout deleted."); break;
    }
    case "delBody": {
      if (state.confirmDel !== el.dataset.id) { state.confirmDel = el.dataset.id; render(); break; }
      remove("body", el.dataset.id); state.confirmDel = null; toast("Entry deleted."); break;
    }
    case "saveBody": {
      const form = $("#body-form"); const entry = { user: state.viewUser, date: $("#body-date").value || TODAY() };
      let any = false; form.querySelectorAll("[data-bf]").forEach(i => { if (i.value !== "") { entry[i.dataset.bf] = +i.value; any = true; } });
      if (!any) { toast("Fill in at least one measurement."); break; }
      save("body", `${entry.user}_${entry.date}_${Date.now().toString(36)}`, entry); toast("Entry saved."); render(); break;
    }
    case "copySummary": {
      const text = $("#summary").textContent;
      const fallback = () => { const r = document.createRange(); r.selectNodeContents($("#summary")); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast("Selected. Copy it from the menu."); };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => toast("Copied. Paste it into a chat with Claude."), fallback); else fallback();
      break;
    }
    case "closeOverlay": closeOverlay(); render(); break;
    case "timerSet": { const t = state.timer; t.total = +el.dataset.n; store.set("twp-rest", t.total); const on = T.isActive("rest"); drawTimer(); if (on) T.start("rest", t.total); break; }
    case "timerAdd": { const t = state.timer; const n = +el.dataset.n; if (!T.adjust("rest", n)) { t.total = Math.max(15, t.total + n); drawTimer(); } break; }
    case "export": exportData(); break;
  }
});

document.addEventListener("twp-timer-done", e => {
  const key = e.detail.key; if (!key.startsWith("set:")) return;
  const [u, date, id, si] = key.slice(4).split("|");
  const item = todaysList(u, date).find(x => x.ex.id === id); if (!item) return;
  const s = sessionFor(u, date); const d = getDraft(u, date, item.ex, s?.exercises?.find(x => x.id === id));
  if (!d.sets[+si]) return;
  d.sets[+si].done = true; putDraft(u, date, id, d);
  setTimeout(render, 1600); // after the end beeps, move the timer on to the next set
});
A.watchOverlay($("#overlay"), [$("header.top"), $("#main"), $("#tabs"), $(".skip")].filter(Boolean), () => {
  const b = $("#overlay [data-act=closeOverlay]"); if (b) b.click(); else closeOverlay();
});
document.getElementById("tabs").addEventListener("click", e => { const b = e.target.closest("button[data-view]"); if (b) go(b.dataset.view); });
document.getElementById("who").addEventListener("click", openSettings);
document.getElementById("gear").addEventListener("click", openSettings);

document.addEventListener("input", e => {
  const el = e.target;
  if (el.dataset.f === "w" || el.dataset.f === "r") {
    const c = cardFor(el); if (!c) return;
    setValue(c, el.dataset.f, el.value === "" ? "" : +el.value, el);
  } else if (el.dataset.cf) {
    const form = $("#cardio-form"); const d = {};
    form.querySelectorAll("[data-cf]").forEach(i => { d[i.dataset.cf] = i.type === "checkbox" ? i.checked : i.value; });
    store.set(`twp-c-${LU()}-${LD()}`, d);
  } else if (el.dataset.kf) {
    const k = checkinDraft(); const f = el.dataset.kf;
    if (f === "notes") k.notes = el.value; else { k.pain[f.slice(5)] = +el.value; const out = document.querySelector(`[data-out="${f}"]`); if (out) out.textContent = el.value; }
    store.set(`twp-k-${LU()}-${LD()}`, k);
  } else if (el.dataset.act === "libQ") {
    state.libF.q = el.value; store.set("twp-libf", state.libF); const pos = el.selectionStart; render();
    const q = $("#lib-q"); if (q) { q.focus(); q.setSelectionRange(pos, pos); }
  } else if (el.dataset.act === "pickerQ") {
    state.pickerQ = el.value; const pos = el.selectionStart; drawPicker();
    const q = $("#picker-q"); q.focus(); q.setSelectionRange(pos, pos);
  }
});
document.addEventListener("submit", e => {
  if (e.target.id !== "email-form") return;
  e.preventDefault();
  const email = $("#au-email").value, pw = $("#au-pw").value; state.auth.email = email;
  if (state.auth.mode === "create") busy(() => createEmailAccount(email, pw, $("#au-name")?.value.trim()));
  else busy(() => signInEmail(email, pw));
});
document.addEventListener("change", e => {
  const el = e.target; const act = el.dataset.act;
  if (act === "progEx") { state.progEx = el.value; render(); }
  if (act === "setAccent") { saveProfile(state.user, { accent: el.value }); setTimeout(() => { applyAppearance(); render(); }, 60); }
  if (act === "setSound") saveProfile(state.user, { sound: el.checked });
  if (el.dataset.a11y) { setA11y({ [el.dataset.a11y]: el.checked }); A.announce(`${el.closest("label")?.querySelector("b")?.textContent || "Option"} ${el.checked ? "on" : "off"}`); }
  if (el.dataset.gym) { const g = { ...gymSet() }; delete g.id; delete g.updatedAt; g[el.dataset.gym] = el.value === "" ? "" : +el.value; save("settings", "gym", g); }
  if (act === "crewRename" && el.value.trim()) renameCrew(state.auth.crewId, el.value.trim()).then(() => toast("Crew renamed."));
  if (act === "planTitle") { const { week, day } = state.sel; editPlan([LU()], [week], day, d => { d.title = el.value.trim(); }); }
  if (act === "planSr") { const c = cardFor(el); const { week, day } = state.sel; editPlan([c.u], [week], day, d => { d.sr[c.id] = el.value.trim(); }); store.del(dKey(c.u, c.date, c.id)); }
  if (act === "libSel") { state.libF[el.dataset.k] = el.value; store.set("twp-libf", state.libF); render(); }
  if (act === "bodyField") { state.bodyField = el.value; render(); }
  if (act === "repCycle") { state.repCycle = +el.value; render(); }
  if (act === "cmpA") { state.cmpA = el.value; render(); }
  if (act === "cmpB") { state.cmpB = el.value; render(); }
  if (act === "logDate" && el.value) { state.logDate = el.value === TODAY() ? null : el.value; state.sel = null; state.userTouchedSel = false; render(); }
  if (act === "partner") { state.partner = el.checked; store.set("twp-partner", state.partner); if (!state.partner) state.logUser = state.user; render(); }
  if (act === "cycleStart" && el.value) { save("settings", "app", { cycleStart: S.mondayOf(el.value) }); state.sel = null; toast("Cycle start updated for both of you."); closeOverlay(); render(); }
  if (act === "import" && el.files?.[0]) {
    el.files[0].text().then(t => importAll(JSON.parse(t))).then(n => toast(`Restored ${n} items.`)).catch(() => toast("That file couldn't be read as a backup."));
  }
});

// ---------------------------------------------------------------- data + sync status
function updateSync() {
  const el = $("#sync"); const f = Object.values(state.flags);
  let cls = "", text = "Synced";
  if (state.error) { cls = "error"; text = "Problem"; }
  else if (!navigator.onLine) { cls = "offline"; text = "Offline"; }
  else if (f.some(x => x.pending)) { cls = "pending"; text = "Syncing"; }
  else if (f.length < COLLECTIONS.length || f.some(x => x.fromCache)) { cls = "pending"; text = "Connecting"; }
  el.className = "sync " + cls; el.textContent = text; el.title = text; el.setAttribute("aria-label", "Sync: " + text);
}
addEventListener("online", updateSync); addEventListener("offline", updateSync);

let renderQueued = false;
function onData(name, docs, fromCache, pending) {
  state.raw[name] = docs;
  state.data[name] = name === "sessions" ? docs.map(normalizeSession) : docs; state.flags[name] = { fromCache, pending };
  if ((name === "settings" || name === "sessions") && !state.userTouchedSel) state.sel = null;
  if (name === "sessions") consolidate();
  if (name === "pings") handlePings();
  if (["sessions", "body", "activities"].includes(name)) checkAchievements();
  updateSync();
  const busyNow = state.overlay || document.activeElement?.matches?.("input, textarea, select");
  if (!busyNow && !renderQueued) { renderQueued = true; requestAnimationFrame(() => { renderQueued = false; render(); }); }
}
function onStatus(status) { state.error = status.state === "error" ? status.message : null; updateSync(); if (state.error) render(); }

// ---------------------------------------------------------------- sign-in & crews
state.auth = { ready: false, user: null, crewId: null, crew: null, members: [], error: "", busy: false, mode: "signin", legacy: null };
let stopData = null, stopCrew = null;
const me = () => state.auth.members.find(m => m.uid === state.auth.user?.uid);
const isOwner = () => state.auth.crew?.owner === state.auth.user?.uid;

function resetData() { for (const k of Object.keys(state.data)) state.data[k] = []; state.raw = {}; state.flags = {}; profMemo = { src: null, map: {} }; libMemo = { src: null, list: [] }; }
function startCrew(id) {
  if (state.auth.crewId === id && stopData) return;
  stopData?.(); stopCrew?.(); resetData();
  state.auth.crewId = id; store.set(`twp-crew-${state.auth.user.uid}`, id);
  stopData = connect(id, onData, onStatus);
  stopCrew = watchCrew(id, crew => {
    if (!crew) {
      // Removed from the crew, or the crew is gone: go back to the join screen.
      stopAll(); store.del(`twp-crew-${state.auth.user.uid}`); setUserDoc(state.auth.user.uid, { crewId: null }).catch(() => {});
      state.auth.error = "You're no longer in that crew. Join another with an invite code, or start your own."; render(); return;
    }
    state.auth.crew = crew; render();
  }, members => {
    state.auth.members = members;
    const m = members.find(x => x.uid === state.auth.user?.uid);
    if (m?.profileId && !state.user) { state.user = m.profileId; state.viewUser = m.profileId; store.set("twp-user", m.profileId); }
    render();
  });
}
function stopAll() { stopData?.(); stopCrew?.(); stopData = stopCrew = null; resetData(); Object.assign(state.auth, { crewId: null, crew: null, members: [] }); }

watchAuth(async (u, err) => {
  if (err) state.auth.error = err;
  state.auth.user = u;
  if (!u) { stopAll(); state.auth.ready = true; render(); return; }
  let crewId = store.get(`twp-crew-${u.uid}`, null);
  try { const d = await getUserDoc(u.uid); if (d?.crewId) crewId = d.crewId; } catch (e) { state.auth.error = e.message; }
  if (crewId) startCrew(crewId);
  state.auth.ready = true; render();
});

async function busy(fn) {
  state.auth.busy = true; state.auth.error = ""; render();
  try { await fn(); } catch (e) { state.auth.error = e.message || String(e); }
  state.auth.busy = false; render();
}

function viewSignIn() {
  const a = state.auth; const create = a.mode === "create";
  return `<section class="signin">
    <button class="btn small a11y-entry" data-act="openA11y"><span aria-hidden="true">♿</span> Accessibility</button>
    ${logoHtml()}<h2 class="visually-hidden">Two-Week Split</h2>
    <p class="muted">Sign in to see your crew's workouts on any phone.</p>
    ${a.error ? `<div class="banner" role="alert">${esc(a.error)}</div>` : ""}
    ${a.notice ? `<div class="reminders">${esc(a.notice)}</div>` : ""}
    <button class="btn block google" data-act="authGoogle" ${a.busy ? "disabled" : ""}><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6c-.3 1.4-1.1 2.5-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.4-2.7l-3.6-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.8C3.8 20.5 7.6 23 12 23z"/><path fill="#FBBC05" d="M5.7 14.1c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1V7.1H2C1.4 8.6 1 10.3 1 12s.4 3.4 1 4.9l3.7-2.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2C17.5 2.1 15 1 12 1 7.6 1 3.8 3.5 2 7.1l3.7 2.8C6.6 7.3 9.1 5.4 12 5.4z"/></svg>Continue with Google</button>
    <div class="or"><span>or use email</span></div>
    <form class="card" id="email-form" style="text-align:left">
      ${create ? `<label class="field">Your name<input type="text" id="au-name" autocomplete="name"></label>` : ""}
      <label class="field">Email<input type="email" id="au-email" autocomplete="email" value="${esc(a.email || "")}"></label>
      <label class="field">Password<input type="password" id="au-pw" autocomplete="${create ? "new-password" : "current-password"}" minlength="6"></label>
      <button class="btn primary block" type="submit" ${a.busy ? "disabled" : ""}>${create ? "Create account" : "Sign in"}</button>
      <div class="row" style="justify-content:space-between">
        <button class="btn small" type="button" data-act="authMode">${create ? "I already have an account" : "Create an account"}</button>
        ${create ? "" : `<button class="btn small" type="button" data-act="authReset">Forgot password?</button>`}
      </div>
    </form>
    <details class="more" style="text-align:left"><summary>Forgot which email you used?</summary><div class="panel small">
      <p>Try Continue with Google first. If that's not it, ask someone in your crew: Settings → Crew lists everyone's sign-in email.</p></div></details>
  </section>`;
}
function logoHtml(size = "") {
  return `<div class="brand-logo ${size}"><img class="on-light" src="icons/logo-dark-text.png" alt="Fitness for Faggy Bunnies"><img class="on-dark" src="icons/logo-light-text.png" alt="Fitness for Faggy Bunnies"></div>`;
}
function viewCrewSetup() {
  const a = state.auth;
  return `<section class="signin">
    <h2>Join your crew</h2>
    <p class="muted">Signed in as ${esc(a.user.email)}. A crew is a private group of training partners who share a gym library and can see each other's progress.</p>
    ${a.error ? `<div class="banner" role="alert">${esc(a.error)}</div>` : ""}
    <section class="card" style="text-align:left"><h3 class="h3">Have an invite code?</h3>
      <label class="field">Invite code<input type="text" id="crew-code" autocapitalize="characters" maxlength="6" placeholder="ABC123" style="font-family:var(--mono);letter-spacing:.2em;text-transform:uppercase"></label>
      <button class="btn primary block" data-act="crewJoin" ${a.busy ? "disabled" : ""}>Join crew</button></section>
    <section class="card" style="text-align:left"><h3 class="h3">Start a new crew</h3>
      <label class="field">Crew name<input type="text" id="crew-name" placeholder="Fitness for Faggy Bunnies"></label>
      <button class="btn block" data-act="crewCreate" ${a.busy ? "disabled" : ""}>Create crew</button></section>
    <button class="btn small" data-act="authSignOut">Sign out</button>
  </section>`;
}
function crewSettings() {
  const a = state.auth; const owner = isOwner();
  return `<section class="card"><h3 class="h3">Crew</h3>
    ${owner ? `<label class="field">Crew name<input type="text" data-act="crewRename" value="${esc(a.crew?.name || "")}"></label>` : `<p><b>${esc(a.crew?.name || "")}</b></p>`}
    <div class="field"><span>Invite code (share it with new members)</span>
      <div class="row"><b class="mono" style="font-size:1.5rem;letter-spacing:.2em" id="invite-code">${esc(a.crew?.code || "")}</b><button class="btn small" data-act="copyCode">Copy</button>${owner ? `<button class="btn small" data-act="newCode">New code</button>` : ""}</div></div>
    <div class="field"><span>Members and their sign-in emails</span>
      ${a.members.map(m => `<div class="list-item"><div>${m.profileId ? avatarHtml(m.profileId) : ""}<b>${esc(m.name || "Member")}</b>${m.role === "owner" ? ` <span class="tag orig">Owner</span>` : ""}<div class="small muted">${esc(m.email)}${m.profileId ? ` · profile: ${esc(P(m.profileId).name)}` : " · no profile picked yet"}</div></div>
        ${owner && m.uid !== a.user.uid ? `<button class="btn small danger" data-act="crewRemove" data-v="${esc(m.uid)}">${state.confirmDel === m.uid ? "Confirm" : "Remove"}</button>` : ""}</div>`).join("")}</div>
    ${owner ? `<details class="more" ${a.legacy ? "open" : ""}><summary>Bring over data from the first version</summary><div class="panel small">
      <p>Copies the workouts, body entries, library, profiles and settings saved before crews existed into this crew. Run it once.</p>
      ${a.legacy ? `<p><b>${a.legacy.count}</b> items found.</p><button class="btn primary" data-act="legacyCopy">Copy ${a.legacy.count} item${a.legacy.count === 1 ? "" : "s"} into this crew</button>` : `<button class="btn" data-act="legacyCheck">Look for old data</button>`}</div></details>` : ""}
  </section>
  <section class="card"><h3 class="h3">Account</h3>
    <p class="small">Signed in as <b>${esc(a.user.email)}</b> with ${a.user.providers.map(p => p === "google.com" ? "Google" : p === "password" ? "email + password" : p).join(" and ")}.</p>
    ${a.user.providers.includes("google.com") ? "" : `<button class="btn small" data-act="linkGoogle">Also sign in with Google</button>`}
    ${a.user.providers.includes("password") ? `<button class="btn small" data-act="authResetMe">Change password (sends an email)</button>` : `<div class="row" style="align-items:end"><label class="field" style="flex:1">Add a password<input type="password" id="link-pw" minlength="6" autocomplete="new-password"></label><button class="btn small" data-act="linkPassword">Add</button></div><p class="small muted">Then you can sign in with ${esc(a.user.email)} and this password if Google sign-in gives you trouble.</p>`}
    <button class="btn small danger" data-act="authSignOut">Sign out</button>
  </section>`;
}

render();
if ("serviceWorker" in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").catch(() => {});
  // When a new version installs, reload once so both phones run the same code.
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadController && !state.overlay) location.reload(); });
}
