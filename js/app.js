// Two-Week Split — app shell, views and events.
import { PROFILES, PLAN, STRETCH, CARDIO, DAYS, DAY_NAMES, ALL_EX, FOCUS, PAIN_AREAS, variantDef, defaultVariant, exDef } from "./plan.js";
import * as S from "./stats.js";
import { connect, save, remove, importAll, COLLECTIONS } from "./firebase.js";

// ---------------------------------------------------------------- helpers
const $ = (s, r = document) => r.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
};
const TODAY = () => S.ymd(new Date());
const other = u => (u === "mat" ? "benny" : "mat");
const yt = q => "https://www.youtube.com/results?search_query=" + encodeURIComponent(q + " proper form");
const ytStretch = q => "https://www.youtube.com/results?search_query=" + encodeURIComponent(q + " stretch how to");
const DIFF = ["", "Easy", "Right", "Hard"];
const VARIANT_LABEL = { std: "Standard", hard: "Harder", swap: "Swap" };
const vLabel = v => (String(v).startsWith("lib:") ? "Library swap" : VARIANT_LABEL[v] || v);
const GROUPS = ["chest", "shoulders", "arms", "back", "core", "glutes", "legs", "calves", "cardio"];
const EQUIP = { machine: "Machine", cable: "Cable", dumbbell: "Dumbbells", barbell: "Barbell / Smith", bodyweight: "Bodyweight", cardio: "Cardio machine", other: "Other" };
const KIND_LABEL = { load: "Weight × reps", bw: "Reps only", time: "Time (seconds)", carry: "Weight × steps", assist: "Assist weight × reps" };
const libItem = id => state.data.library.find(x => x.id === id);
const libForFocus = focus => state.data.library.filter(m => (m.focus || []).some(f => focus.includes(f)));
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

let toastTimer;
function toast(msg) {
  let t = $(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = msg;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 3000);
}

// ---------------------------------------------------------------- state
const state = {
  user: store.get("twp-user", null),
  partner: store.get("twp-partner", false),
  view: store.get("twp-view", "today"),
  logUser: null, logDate: null, viewUser: null, sel: null, userTouchedSel: false,
  variants: store.get("twp-variants", {}),
  editing: new Set(),
  data: { sessions: [], body: [], activities: [], settings: [], library: [] }, libFilter: "all", libEdit: null, libSwapFor: null,
  flags: {}, error: null,
  progTab: "lifts", progEx: null, bodyField: "weight",
  repTab: "cycle", repCycle: null, cmpA: null, cmpB: null,
  confirmDel: null, timer: null, overlay: null, pickerQ: "",
  charts: []
};
if (!["mat", "benny"].includes(state.user)) state.user = null;
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
const variantOf = (u, ex) => state.variants[`${u}:${ex.id}`] || defaultVariant(ex, u);

// ---------------------------------------------------------------- sessions: one document per person per day
const sid = (u, date) => `${u}_${date}`;
const sessionFor = (u, date) => state.data.sessions.find(s => s.id === sid(u, date)) || state.data.sessions.find(s => s.user === u && s.date === date) || null;

function writeSession(u, date, patch) {
  const cur = sessionFor(u, date);
  const base = cur ? { ...cur } : { user: u, date, week: state.sel.week, day: state.sel.day, exercises: [] };
  delete base.id; delete base.updatedAt;
  save("sessions", sid(u, date), { ...base, ...patch });
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
    const merged = { user, date, week: docs[0].week, day: docs[0].day, exercises: [...ex.values()], cardio, pain: latest("pain") || null, recovery: latest("recovery") || null, notes };
    if (merged.pain || merged.recovery || notes) merged.checkin = true;
    save("sessions", sid(user, date), merged);
    for (const d of docs) if (d.id !== sid(user, date)) remove("sessions", d.id);
  }
  merging = false;
}

// ---------------------------------------------------------------- per-exercise drafts (kept on this phone until saved)
const dKey = (u, date, id) => `twp-x-${u}-${date}-${id}`;
const editKey = (u, date, id) => `${u}|${date}|${id}`;

function prefillSets(u, def, id, v) {
  const last = S.lastTime(state.data.sessions, u, id, v);
  if (last && last.sets?.length) return { sets: last.sets.map(s => ({ w: s.w || 0, r: s.r || 0, d: 2 })), fresh: false };
  const { sets, min, max } = S.parseRange(def.sr || "3 × 10");
  const start = PROFILES[u].start[v === "std" ? id : `${id}:${v}`] ?? 0;
  const r = def.kind === "time" ? (min || 30) : (max || min || 10);
  return { sets: Array.from({ length: sets || 3 }, () => ({ w: start, r, d: 2 })), fresh: true };
}
function getDraft(u, date, ex, logged) {
  const k = dKey(u, date, ex.id); let d = store.get(k, null);
  if (d) return d;
  if (logged) return { variant: logged.variant || "std", sets: logged.sets.map(s => ({ ...s })), fresh: false };
  const v = ex.custom ? "std" : variantOf(u, ex);
  const def = defOf(ex, v);
  const p = prefillSets(u, { sr: def.sr, kind: def.kind }, ex.id, v);
  return { variant: v, ...p };
}
const putDraft = (u, date, id, d) => store.set(dKey(u, date, id), d);

// Extra exercises added for a day but not saved yet.
const xKey = (u, date) => `twp-extra-${u}-${date}`;
const getExtras = (u, date) => store.get(xKey(u, date), []);

function todaysList(u, date) {
  const { week, day } = state.sel;
  const s = sessionFor(u, date);
  const list = PLAN[week][day].ex.map(ex => ({ ex, added: false }));
  const ids = new Set(list.map(x => x.ex.id));
  for (const e of s?.exercises || []) if (!ids.has(e.id)) { ids.add(e.id); list.push({ ex: exDef(e.id, e), added: true }); }
  for (const e of getExtras(u, date)) if (!ids.has(e.id)) { ids.add(e.id); list.push({ ex: exDef(e.id, e), added: true }); }
  return list;
}

// ---------------------------------------------------------------- render
function render() {
  const main = $("#main");
  destroyCharts();
  if (!state.user) {
    document.body.dataset.user = "";
    $("#tabs").classList.add("hidden"); $("#who").classList.add("hidden");
    main.innerHTML = `<section class="pick"><h2>Who's training?</h2>
      <button class="btn mat" data-act="pickUser" data-u="mat">Mat</button>
      <button class="btn benny" data-act="pickUser" data-u="benny">Benny</button>
      <p class="muted small">You can switch any time from the name button at the top.</p></section>`;
    return;
  }
  if (!state.partner) state.logUser = state.user;
  document.body.dataset.user = state.view === "today" ? LU() : state.viewUser || state.user;
  $("#tabs").classList.remove("hidden");
  const who = $("#who"); who.classList.remove("hidden"); who.textContent = PROFILES[state.user].name + (state.partner ? " + " + PROFILES[other(state.user)].name : "");
  document.querySelectorAll("#tabs button").forEach(b => { if (b.dataset.view === state.view) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  if (!state.sel) {
    const s = sessionFor(LU(), LD());
    state.sel = s && s.week && s.day ? { week: s.week, day: s.day } : autoSel();
  }
  if (!state.viewUser) state.viewUser = state.user;
  const banner = state.error ? `<div class="banner" role="alert">${esc(state.error)}</div>` : "";
  const views = { today: viewToday, progress: viewProgress, body: viewBody, report: viewReport, gym: viewGym };
  main.innerHTML = banner + views[state.view]();
  afterRender();
}

function personToggle(act = "viewUser", cur = state.viewUser) {
  return `<div class="seg" role="group" aria-label="Person">${["mat", "benny"].map(u => `<button data-act="${act}" data-u="${u}" aria-pressed="${cur === u}">${PROFILES[u].name}</button>`).join("")}</div>`;
}
function seg(act, current, opts, label, extra = "") {
  return `<div class="seg" role="group" aria-label="${esc(label || act)}">${opts.map(([v, l]) => `<button data-act="${act}" data-v="${v}" ${extra} aria-pressed="${current === v}">${esc(l)}</button>`).join("")}</div>`;
}

// ---------------------------------------------------------------- TODAY (plan + logging in one place)
function viewToday() {
  const u = LU(), p = PROFILES[u], date = LD();
  const { week, day } = state.sel; const plan = PLAN[week][day];
  const ci = S.cycleInfo(TODAY(), cycleStart());
  const s = sessionFor(u, date);
  const list = todaysList(u, date);
  const done = list.filter(x => s?.exercises?.some(e => e.id === x.ex.id)).length;
  const notToday = date !== TODAY();
  return `
  ${state.partner ? `<section class="card"><span class="eyebrow">Partner mode · logging for</span>${personToggle("logUser", u)}</section>` : ""}
  ${notToday ? `<div class="banner">Showing ${S.fmtDate(date)}. <button class="btn small" data-act="backToToday">Back to today</button></div>` : ""}
  <section class="card">
    <div class="between"><span class="eyebrow">${ci.week === week && !notToday ? "This week is" : "Viewing"} Week ${week}</span><span class="small muted mono">${done}/${list.length} done</span></div>
    ${seg("selWeek", week, [["A", "Week A"], ["B", "Week B"]], "Week")}
    <div class="chips" role="group" aria-label="Day">${DAYS.map(d => `<button data-act="selDay" data-v="${d}" aria-pressed="${d === day}">${d}<small>${esc(PLAN[week][d].title.split(",")[0])}</small></button>`).join("")}</div>
    <h2 class="h2">${DAY_NAMES[day]} · ${esc(plan.title)}</h2>
    <details class="more"><summary>${esc(p.name)}'s focus, notes and date</summary><div class="panel"><p>${esc(p.focusNote)}</p><ul class="small">${p.notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul>
      <label class="field">Logging date<input type="date" data-act="logDate" value="${date}"></label></div></details>
  </section>
  ${cardioCard(u, date, s)}
  ${list.map(({ ex, added }) => exerciseCard(u, date, ex, added, s)).join("")}
  <button class="btn block add-ex" data-act="openPicker">+ Add an exercise</button>
  ${checkinCard(u, date, s)}`;
}

function exerciseCard(u, date, ex, added, s) {
  const logged = s?.exercises?.find(e => e.id === ex.id);
  const ek = editKey(u, date, ex.id);
  if (logged && !state.editing.has(ek)) {
    const def = S.defFor(ex.id, logged.variant || "std", logged);
    return `<article class="card ex done-card" id="ex-${ex.id}">
      <div class="head"><div class="name"><span class="tick" aria-hidden="true">✓</span>${esc(logged.name || def.name)}${logged.variant && logged.variant !== "std" ? `<span class="tag new">${vLabel(logged.variant)}</span>` : ""}${added ? `<span class="tag orig">Added</span>` : ""}</div><button class="btn small" data-act="editEx" data-ex="${ex.id}">Log</button></div>
      <div class="last"><b>${esc(S.setsText(logged))}</b></div>
    </article>`;
  }
  const d = getDraft(u, date, ex, logged);
  const v = d.variant;
  const lib = String(v).startsWith("lib:") ? libItem(v.slice(4)) : null;
  const def = defOf(ex, v);
  const opts = [["std", "Standard"]]; if (ex.h) opts.push(["hard", "Harder"]); if (ex.swap) opts.push(["swap", "Swap"]);
  if (!ex.custom) opts.push(["lib", "Library"]);
  const why = lib ? (lib.notes || `From your gym library. Same target: ${ex.sr}.`) : v === "hard" && ex.h ? ex.h.how : v === "swap" && ex.swap ? ex.swap.how : ex.why;
  const last = S.lastTime(state.data.sessions, u, ex.id, v);
  const sug = ex.custom ? null : S.suggestion(state.data.sessions, u, ex.id, v);
  const pu = other(u), pLast = state.partner ? S.lastTime(state.data.sessions, pu, ex.id, ex.custom ? "std" : variantOf(pu, ex)) : null;
  const entry = { kind: def.kind, db: def.db };
  return `<article class="card ex" id="ex-${ex.id}" data-ex="${ex.id}">
    <div class="head"><div class="name">${esc(def.name)}${ex.custom || lib ? "" : `<span class="tag ${ex.tag}">${ex.tag === "orig" ? "Original" : "New"}</span>`}${added ? `<span class="tag orig">Added</span>` : ""}</div><span class="sr">${esc(def.sr || "")}</span></div>
    ${opts.length > 1 ? seg("variant", String(v).startsWith("lib:") ? "lib" : v, opts, "Version") : ""}
    ${why ? `<div class="why">${esc(why)}</div>` : ""}
    ${lib ? `<div class="row"><a class="video" href="${yt(lib.name)}" target="_blank" rel="noopener">Watch form videos</a><button class="btn small" data-act="libSwap">Change machine</button></div>` : ""}
    ${ex.notes?.[u] ? `<div class="note">${esc(ex.notes[u])}</div>` : ""}
    <div class="last">${last ? `Last time (${S.fmtDate(last.date)}): <b>${esc(S.describeSets(last.kind, last.db, last.sets))}</b>` : "No history yet for this version."}</div>
    ${state.partner ? `<div class="last">${PROFILES[pu].name}: ${pLast ? `<b>${esc(S.describeSets(pLast.kind, pLast.db, pLast.sets))}</b>` : "no history yet"}</div>` : ""}
    ${sug ? `<div class="pill ${sug.type}">${esc(sug.text)}</div>` : ""}
    ${d.fresh ? `<div class="pill hold fresh-note">First time: set the weight and reps you actually did.</div>` : ""}
    <div class="sets">${d.sets.map((x, i) => setRow(entry, x, i)).join("")}</div>
    <div class="row"><button class="btn small" data-act="addSet">+ Add set</button><button class="btn small" data-act="timer">Rest timer</button>
      ${logged ? `<button class="btn small" data-act="cancelEdit">Cancel</button><button class="btn small danger" data-act="deleteEx">${state.confirmDel === ek ? "Confirm delete" : "Delete"}</button>` : added ? `<button class="btn small danger" data-act="dropExtra">Remove</button>` : ""}</div>
    <button class="btn primary block" data-act="saveEx">${logged ? "Save changes" : "Save exercise"}</button>
    ${ex.custom ? "" : `<details class="more"><summary>Form, video &amp; stretches</summary>${exPanel(ex)}</details>`}
  </article>`;
}

function exPanel(ex) {
  return `<div class="panel">
    <div><h4>How to do it · ${esc(ex.n)}</h4><p>${esc(ex.setup)}</p><a class="video" href="${yt(ex.q)}" target="_blank" rel="noopener">Watch form videos</a></div>
    ${ex.h ? `<div><h4>Harder · ${esc(ex.h.n)} · ${esc(ex.h.sr)}</h4><p>${esc(ex.h.how)}</p><a class="video" href="${yt(ex.h.q)}" target="_blank" rel="noopener">Watch form videos</a></div>` : ""}
    ${ex.swap ? `<div><h4>Swap · ${esc(ex.swap.n)}${ex.swap.sr ? ` · ${esc(ex.swap.sr)}` : ""}</h4><p>${esc(ex.swap.how)}</p><a class="video" href="${yt(ex.swap.q)}" target="_blank" rel="noopener">Watch form videos</a></div>` : ""}
    ${ex.v ? `<div><h4>More lunge types to rotate in</h4><div class="panel">${ex.v.map(x => `<div class="stretch"><b>${esc(x.n)}</b><p>${esc(x.h)}</p><a href="${yt(x.q)}" target="_blank" rel="noopener">Video</a></div>`).join("")}</div></div>` : ""}
    <div><h4>Between sets, while your partner's up</h4><div class="panel">${ex.s.map(stretchBox).join("")}</div></div>
  </div>`;
}
function stretchBox(k) {
  const s = STRETCH[k];
  return `<div class="stretch"><b>${esc(s.n)}<span>${esc(s.t)}</span></b><p>${esc(s.h)}</p><a href="${ytStretch(s.n)}" target="_blank" rel="noopener">See it done</a></div>`;
}
function setRow(e, s, si) {
  const u = S.unitLabel(e.kind, e.db);
  const rStep = e.kind === "time" || e.kind === "carry" ? 5 : 1;
  return `<div class="set ${u.w ? "" : "noweight"}" data-s="${si}">
    <span class="n">${si + 1}</span>
    ${u.w ? stepper("w", s.w, u.w, e.db ? 2.5 : 5) : ""}
    ${stepper("r", s.r, u.r, rStep)}
    <div class="diff" role="group" aria-label="How set ${si + 1} felt">${[1, 2, 3].map(d => `<button type="button" data-act="diff" data-d="${d}" aria-pressed="${(s.d || 2) === d}">${DIFF[d]}</button>`).join("")}<button type="button" class="del" data-act="delSet" aria-label="Remove set ${si + 1}">×</button></div>
  </div>`;
}
function stepper(f, val, label, step) {
  return `<div><div class="stepper"><button type="button" data-act="step" data-f="${f}" data-by="${-step}" aria-label="Less">−</button><input type="number" inputmode="decimal" step="any" data-f="${f}" value="${esc(val)}" aria-label="${esc(label)}"><button type="button" data-act="step" data-f="${f}" data-by="${step}" aria-label="More">+</button></div><div class="stepper-label">${esc(label)}</div></div>`;
}

// Cardio: its own save.
function cardioCard(u, date, s) {
  const { week, day } = state.sel; const cp = CARDIO[u].plan(week, day);
  const ek = editKey(u, date, "cardio");
  const commute = state.data.activities.find(a => a.id === `${u}-${date}-commute`);
  if ((s?.cardio?.done || s?.cardio?.skipped) && !state.editing.has(ek)) {
    const c = s.cardio;
    return `<section class="card cardio-card done-card"><div class="head"><div class="name"><span class="tick">✓</span>Cardio</div><button class="btn small" data-act="editCardio">Log</button></div>
      <div class="last"><b>${c.skipped ? "Skipped: biked to work" : `${esc(c.type)}, ${c.minutes || 0} min${c.miles ? `, ${c.miles} mi` : ""}${c.avgHr ? `, avg HR ${c.avgHr}` : ""}${c.hiit ? ", intervals" : ""}`}</b>${commute ? ` · Bike commute ${commute.miles} mi` : ""}</div></section>`;
  }
  const c = store.get(`twp-c-${u}-${date}`, null) || { type: s?.cardio?.type || cp.type, minutes: s?.cardio?.minutes ?? 25, miles: s?.cardio?.miles ?? "", avgHr: s?.cardio?.avgHr ?? "", hiit: s?.cardio?.hiit ?? !!cp.hiit, commute: !!commute, commuteMiles: commute?.miles ?? PROFILES[u].commute.miles };
  const partner = state.partner ? CARDIO[other(u)].plan(week, day) : null;
  return `<section class="card cardio-card" id="cardio-form">
    <div class="between"><h3 class="h3">Cardio · ${esc(cp.type)}</h3>${cp.hiit ? `<span class="tag new">Intervals</span>` : ""}</div>
    <p>${esc(cp.text)}</p>
    ${partner ? `<p class="small muted"><b>${PROFILES[other(u)].name}:</b> ${esc(partner.type)}. ${esc(partner.text)}</p>` : ""}
    <details class="more" ${state.editing.has(ek) ? "open" : ""}><summary>Log cardio</summary><div class="panel">
      <div class="grid2">
        <label class="field">Machine<select data-cf="type">${CARDIO[u].options.map(o => `<option ${o === c.type ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></label>
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
    return `<section class="card done-card"><div class="head"><div class="name"><span class="tick">✓</span>Check-in</div><button class="btn small" data-act="editCheckin">Log</button></div>
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
  const libList = state.data.library.filter(m => !onList.has(`lib-${m.id}`) && match(m.name)).sort((a, b) => a.name.localeCompare(b.name)).map(m => `<button class="list-btn" data-act="pickLib" data-id="${esc(m.id)}"><b>${esc(m.name)}</b><span class="small muted">${esc((m.focus || []).map(f => FOCUS[f]).join(", ") || "Library")}</span></button>`).join("");
  const cust = [...customs.values()].filter(e => !onList.has(e.id) && match(e.name)).map(e => item(e.id, e.name, "Your exercise")).join("");
  const plan = Object.values(ALL_EX).filter(e => !onList.has(e.id) && match(e.n)).map(e => item(e.id, e.n, `Week ${e.week} ${e.day} · ${e.sr}`)).join("");
  $("#overlay").innerHTML = `<div class="overlay" role="dialog" aria-label="Add an exercise"><div class="inner">
    <div class="between"><h2 class="h2">Add an exercise</h2><button class="btn small" data-act="closeOverlay">Close</button></div>
    <label class="field">Search<input type="text" id="picker-q" data-act="pickerQ" value="${esc(state.pickerQ)}" placeholder="Hip adductor, row, curl…" autocomplete="off"></label>
    <section class="card"><h3 class="h3">A machine that isn't in the plan</h3>
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
  if (ex.custom) return { name: ex.n, sr: ex.sr, kind: ex.kind, db: ex.db, focus: ex.focus?.length ? ex.focus : undefined };
  if (String(v).startsWith("lib:")) {
    const m = libItem(v.slice(4));
    return { name: m?.name || "Library machine", sr: ex.sr, kind: m?.kind || ex.kind, db: !!m?.db, q: m?.name || ex.q };
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
  const rel = libForFocus(ex.focus).sort((a, b) => a.name.localeCompare(b.name));
  const rest = state.data.library.filter(m => !rel.includes(m)).sort((a, b) => a.name.localeCompare(b.name));
  const btn = m => `<button class="list-btn" data-act="pickLibSwap" data-id="${esc(m.id)}"><b>${esc(m.name)}</b><span class="small muted">${esc((m.focus || []).map(f => FOCUS[f]).join(", "))}${m.equip ? ` · ${esc(EQUIP[m.equip] || m.equip)}` : ""}</span></button>`;
  $("#overlay").innerHTML = `<div class="overlay" role="dialog" aria-label="Swap from library"><div class="inner">
    <div class="between"><h2 class="h2">Swap from library</h2><button class="btn small" data-act="closeOverlay">Close</button></div>
    <p class="muted">Instead of <b>${esc(ex.n)}</b>, which works ${esc(ex.focus.filter(f => FOCUS[f]).map(f => FOCUS[f].toLowerCase()).join(" and "))}. Same target: ${esc(ex.sr)}.</p>
    <section class="card"><h3 class="h3">Machines that work the same areas</h3>
      ${rel.length ? `<div class="pick-list">${rel.map(btn).join("")}</div>` : `<p class="muted small">Nothing in the library works these areas yet. Add machines on the Gym tab and tag what they work.</p>`}</section>
    ${rest.length ? (state.libSwapAll ? `<section class="card"><h3 class="h3">Everything else</h3><div class="pick-list">${rest.map(btn).join("")}</div></section>` : `<button class="btn" data-act="libShowAll">Show all ${state.data.library.length} machines</button>`) : ""}
  </div></div>`;
}

// ---------------------------------------------------------------- GYM LIBRARY
function viewGym() {
  const lib = state.data.library.slice().sort((a, b) => a.name.localeCompare(b.name));
  const f = state.libFilter;
  const shown = f === "all" ? lib : lib.filter(m => (m.focus || []).includes(f));
  const editing = state.libEdit ? libItem(state.libEdit) : null;
  const inLib = new Set(lib.map(m => m.name.toLowerCase()));
  const quick = Object.values(ALL_EX).filter(e => !inLib.has(e.n.toLowerCase()) && !/push-up|plank|dead bug|v-up|crunch|sit-up|jump|lunge|carry|split squat|hold/i.test(e.n));
  const seen = new Set(); const quickU = quick.filter(e => !seen.has(e.n) && seen.add(e.n));
  const counts = Object.fromEntries(GROUPS.map(g => [g, lib.filter(m => (m.focus || []).includes(g)).length]));
  return `<section class="card"><div class="between"><h2 class="h2">Gym library</h2><span class="small muted mono">${lib.length} machines</span></div>
    <p class="small muted">The equipment at our gym, tagged by what it works. Swaps and "Add an exercise" pull from here.</p>
    <div class="focus-chips">${[["all", `All ${lib.length}`], ...GROUPS.map(g => [g, `${FOCUS[g]} ${counts[g]}`])].map(([v, l]) => `<button type="button" data-act="libFilter" data-v="${v}" aria-pressed="${f === v}">${esc(l)}</button>`).join("")}</div>
  </section>
  ${shown.length ? `<section class="card">${shown.map(m => `<div class="list-item"><div><b>${esc(m.name)}</b><div class="small muted">${esc((m.focus || []).map(x => FOCUS[x]).join(", ") || "No focus tagged")}${m.equip ? ` · ${esc(EQUIP[m.equip] || m.equip)}` : ""} · ${esc(KIND_LABEL[m.kind || "load"])}</div>${m.notes ? `<div class="small">${esc(m.notes)}</div>` : ""}</div>
    <div class="row"><button class="btn small" data-act="libEdit" data-id="${esc(m.id)}">Edit</button></div></div>`).join("")}</section>` : `<section class="card"><p class="muted">${lib.length ? "Nothing tagged with this area yet." : "The library is empty. Add the machines you see at the gym below, or quick-add the ones already in the plan."}</p></section>`}
  ${libForm(editing)}
  ${quickU.length ? `<section class="card"><details class="more"><summary>Quick add machines from our plan (${quickU.length})</summary><div class="panel"><p class="small muted">One tap adds it with the plan's focus areas. Edit afterwards if needed.</p><div class="pick-list">${quickU.map(e => `<button class="list-btn" data-act="libQuick" data-id="${e.id}"><b>${esc(e.n)}</b><span class="small muted">${esc(e.focus.filter(x => GROUPS.includes(x)).map(x => FOCUS[x]).join(", "))}</span></button>`).join("")}</div></div></details></section>` : ""}`;
}
function libForm(m) {
  const focus = m?.focus || [];
  return `<section class="card" id="lib-form"><h3 class="h3">${m ? `Edit ${esc(m.name)}` : "Add a machine"}</h3>
    <label class="field">Name<input type="text" id="lib-name" value="${esc(m?.name || "")}" placeholder="Hip Adductor Machine"></label>
    <div class="field"><span>What it works (pick all that apply)</span><div class="focus-chips" id="lib-focus">${GROUPS.map(g => `<button type="button" data-act="libFocus" data-v="${g}" aria-pressed="${focus.includes(g)}">${FOCUS[g]}</button>`).join("")}</div></div>
    <div class="grid2">
      <label class="field">Equipment<select id="lib-equip">${Object.entries(EQUIP).map(([k, l]) => `<option value="${k}" ${m?.equip === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="field">What you track<select id="lib-kind">${Object.entries(KIND_LABEL).map(([k, l]) => `<option value="${k}" ${(m?.kind || "load") === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    </div>
    <label class="check"><input type="checkbox" id="lib-db" ${m?.db ? "checked" : ""}><span>Dumbbells (weight per hand)</span></label>
    <label class="field">Notes<textarea id="lib-notes" placeholder="Where it is, seat setting, how it works…">${esc(m?.notes || "")}</textarea></label>
    <div class="row"><button class="btn primary" data-act="libSave">${m ? "Save changes" : "Add to library"}</button>${m ? `<button class="btn" data-act="libCancel">Cancel</button><button class="btn danger" data-act="libDelete" data-id="${esc(m.id)}">${state.confirmDel === m.id ? "Confirm delete" : "Delete"}</button>` : ""}</div>
  </section>`;
}
function saveLibrary() {
  const name = $("#lib-name").value.trim(); if (!name) { toast("Give it a name first."); return; }
  const focus = [...document.querySelectorAll("#lib-focus [aria-pressed=true]")].map(b => b.dataset.v);
  if (!focus.length) { toast("Pick at least one area it works, so it can show up as a swap."); return; }
  const id = state.libEdit || slug(name);
  save("library", id, { name, focus, equip: $("#lib-equip").value, kind: $("#lib-kind").value, db: $("#lib-db").checked, notes: $("#lib-notes").value.trim() });
  toast(state.libEdit ? "Saved." : `Added ${name}.`); state.libEdit = null; render();
}

// ---------------------------------------------------------------- PROGRESS
function viewProgress() {
  const tab = state.progTab;
  const body = { lifts: progLifts, focus: progFocus, cardio: progCardio, pain: progPain, history: progHistory }[tab]();
  return `<section class="card"><div class="between"><h2 class="h2">Progress</h2>${personToggle()}</div>
    ${seg("progTab", tab, [["lifts", "Lifts"], ["focus", "Focus"], ["cardio", "Cardio"], ["pain", "Pain"], ["history", "History"]], "Section")}</section>${body}`;
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
    <pre class="summary" id="summary">${esc(S.reportText(r))}</pre>
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
  config.options = { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { labels: { boxWidth: 12 } } }, ...config.options };
  state.charts.push(new Chart(el, config));
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
let tick, audio, wake;
function openTimer(exId) {
  const ex = ALL_EX[exId] || exDef(exId);
  state.overlay = "timer";
  state.timer = { ex, total: store.get("twp-rest", 90), left: store.get("twp-rest", 90), running: false, endAt: 0, done: false };
  drawTimer();
}
function drawTimer() {
  const t = state.timer; if (!t) return;
  const secs = Math.max(0, Math.ceil(t.left)); const m = Math.floor(secs / 60), s = secs % 60;
  $("#overlay").innerHTML = `<div class="overlay" role="dialog" aria-label="Rest timer"><div class="inner">
    <div class="between"><span class="eyebrow">Rest · ${esc(t.ex?.n || "")}</span><button class="btn small" data-act="closeOverlay">Close</button></div>
    <div class="clock ${t.done ? "done" : ""}" aria-live="polite">${t.done ? "GO" : `${m}:${String(s).padStart(2, "0")}`}</div>
    <div class="ring"><div style="width:${t.total ? Math.max(0, (t.left / t.total) * 100) : 0}%"></div></div>
    <div class="row" style="justify-content:center">${[60, 90, 120].map(n => `<button class="btn small" data-act="timerSet" data-n="${n}" aria-pressed="${t.total === n}">${n}s</button>`).join("")}
      <button class="btn small" data-act="timerAdd" data-n="-15">−15</button><button class="btn small" data-act="timerAdd" data-n="15">+15</button></div>
    <button class="btn primary block" data-act="timerGo">${t.running ? "Pause" : t.done ? "Restart" : "Start"}</button>
    ${t.ex?.s?.length ? `<h3 class="h3">Stretch while you wait</h3>${t.ex.s.map(stretchBox).join("")}` : ""}
  </div></div>`;
}
function runTimer() {
  const t = state.timer;
  if (t.running) { t.running = false; t.left = Math.max(0, (t.endAt - Date.now()) / 1000); clearInterval(tick); releaseWake(); drawTimer(); return; }
  if (t.done || t.left <= 0) { t.left = t.total; t.done = false; }
  try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume?.(); } catch { /* no audio */ }
  navigator.wakeLock?.request("screen").then(w => (wake = w)).catch(() => {});
  t.running = true; t.endAt = Date.now() + t.left * 1000;
  clearInterval(tick);
  tick = setInterval(() => {
    t.left = (t.endAt - Date.now()) / 1000;
    if (t.left <= 0) { t.left = 0; t.running = false; t.done = true; clearInterval(tick); releaseWake(); alarm(); }
    if (state.timer === t && $("#overlay .clock")) drawTimer();
  }, 250);
  drawTimer();
}
function alarm() {
  navigator.vibrate?.([300, 120, 300, 120, 300]);
  try {
    [0, .35, .7].forEach(off => {
      const o = audio.createOscillator(), g = audio.createGain(); o.frequency.value = 880; o.connect(g); g.connect(audio.destination);
      g.gain.setValueAtTime(.001, audio.currentTime + off); g.gain.exponentialRampToValueAtTime(.4, audio.currentTime + off + .02); g.gain.exponentialRampToValueAtTime(.001, audio.currentTime + off + .25);
      o.start(audio.currentTime + off); o.stop(audio.currentTime + off + .3);
    });
  } catch { /* audio unavailable */ }
}
function releaseWake() { wake?.release?.().catch(() => {}); wake = null; }
function closeOverlay() { clearInterval(tick); releaseWake(); state.timer = null; state.overlay = null; $("#overlay").innerHTML = ""; }

function openSettings() {
  state.overlay = "settings";
  const cs = cycleStart(); const ci = S.cycleInfo(TODAY(), cs);
  $("#overlay").innerHTML = `<div class="overlay" role="dialog" aria-label="Settings"><div class="inner">
    <div class="between"><h2 class="h2">Settings</h2><button class="btn small" data-act="closeOverlay">Close</button></div>
    <section class="card"><h3 class="h3">Who's using this phone</h3>${personToggle("pickUser", state.user)}
      <label class="check"><input type="checkbox" data-act="partner" ${state.partner ? "checked" : ""}><span>Partner mode: log both of us from this phone</span></label>
      <p class="small muted">For when one phone is dead or in a locker. Today gets a Mat / Benny switch at the top.</p></section>
    <section class="card"><h3 class="h3">Two-week cycle</h3>
      <label class="field">Week A started on (a Monday)<input type="date" data-act="cycleStart" value="${cs}"></label>
      <p class="small muted">Today is in Week ${ci.week}. This setting is shared by both of you.</p></section>
    <section class="card"><h3 class="h3">Install on your phone</h3>
      <p class="small"><b>iPhone:</b> open this page in Safari, tap Share, then Add to Home Screen.</p>
      <p class="small"><b>Android:</b> open it in Chrome, tap the ⋮ menu, then Install app.</p>
      <p class="small muted">Once installed it opens like an app and works without signal. Anything you log offline syncs when you're back online.</p></section>
    <section class="card"><h3 class="h3">Backup</h3>
      <div class="row"><button class="btn" data-act="export">Download backup</button><label class="btn">Restore backup<input type="file" accept="application/json" data-act="import" hidden></label></div>
      <p class="small muted">One file with every workout, body entry and commute for both of you.</p></section>
  </div></div>`;
}
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
  const exercises = (s?.exercises || []).filter(e => e.id !== c.id);
  const planOrder = todaysList(c.u, c.date).map(x => x.ex.id);
  exercises.push(entry); exercises.sort((a, b) => planOrder.indexOf(a.id) - planOrder.indexOf(b.id));
  writeSession(c.u, c.date, { exercises });
  store.del(dKey(c.u, c.date, c.id));
  store.set(xKey(c.u, c.date), getExtras(c.u, c.date).filter(x => x.id !== c.id));
  state.editing.delete(editKey(c.u, c.date, c.id));
  toast(`Saved ${def.name}.`);
}
function saveCardio(skip) {
  const u = LU(), date = LD(); const form = $("#cardio-form");
  const val = k => form.querySelector(`[data-cf="${k}"]`);
  const c = skip ? { skipped: "commute", done: false } : {
    done: true, type: val("type").value, minutes: +val("minutes").value || 0,
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
}

// ---------------------------------------------------------------- events
function go(view) { state.view = view; state.confirmDel = null; store.set("twp-view", view); render(); scrollTo(0, 0); }

document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const act = el.dataset.act; const v = el.dataset.v;
  switch (act) {
    case "pickUser": state.user = el.dataset.u; state.viewUser = state.user; state.logUser = state.user; state.sel = null; store.set("twp-user", state.user); if (state.overlay) closeOverlay(); render(); break;
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
      const c = cardFor(el); const f = el.dataset.f; const old = c.d.sets[c.si][f];
      setValue(c, f, Math.max(0, +(((+old || 0) + +el.dataset.by)).toFixed(2))); break;
    }
    case "diff": {
      const c = cardFor(el); c.d.sets[c.si].d = +el.dataset.d; c.d.fresh = false; putDraft(c.u, c.date, c.id, c.d);
      el.parentElement.querySelectorAll("[data-d]").forEach(b => b.setAttribute("aria-pressed", b === el)); c.card.querySelector(".fresh-note")?.remove(); break;
    }
    case "delSet": { const c = cardFor(el); c.d.sets.splice(c.si, 1); putDraft(c.u, c.date, c.id, c.d); render(); break; }
    case "addSet": { const c = cardFor(el); c.d.sets.push({ ...(c.d.sets[c.d.sets.length - 1] || { w: 0, r: 10 }), d: 2 }); putDraft(c.u, c.date, c.id, c.d); render(); break; }
    case "saveEx": { const c = cardFor(el); saveExercise(c); render(); break; }
    case "editEx": { const u = LU(), date = LD(); state.editing.add(editKey(u, date, el.dataset.ex)); render(); break; }
    case "cancelEdit": { const c = cardFor(el); store.del(dKey(c.u, c.date, c.id)); state.editing.delete(editKey(c.u, c.date, c.id)); render(); break; }
    case "deleteEx": {
      const c = cardFor(el); const k = editKey(c.u, c.date, c.id);
      if (state.confirmDel !== k) { state.confirmDel = k; render(); break; }
      state.confirmDel = null; const s = sessionFor(c.u, c.date);
      writeSession(c.u, c.date, { exercises: (s?.exercises || []).filter(x => x.id !== c.id) });
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
    case "libFilter": state.libFilter = v; render(); break;
    case "libFocus": el.setAttribute("aria-pressed", el.getAttribute("aria-pressed") !== "true"); break;
    case "libSave": saveLibrary(); break;
    case "libEdit": state.libEdit = el.dataset.id; render(); setTimeout(() => $("#lib-form")?.scrollIntoView({ block: "start" }), 30); break;
    case "libCancel": state.libEdit = null; render(); break;
    case "libDelete": {
      if (state.confirmDel !== el.dataset.id) { state.confirmDel = el.dataset.id; render(); break; }
      remove("library", el.dataset.id); state.confirmDel = null; state.libEdit = null; toast("Removed from the library."); break;
    }
    case "libQuick": { const ex = ALL_EX[el.dataset.id]; save("library", slug(ex.n), { name: ex.n, focus: ex.focus.filter(f => GROUPS.includes(f)), equip: guessEquip(ex.n), kind: ex.kind, db: ex.db, notes: "" }); toast(`Added ${ex.n}.`); break; }
    case "pickLib": { const m = libItem(el.dataset.id); if (m) addExtra({ id: `lib-${m.id}`, name: m.name, kind: m.kind || "load", db: !!m.db, focus: m.focus || [] }); break; }
    case "pickEx": { const ex = ALL_EX[el.dataset.id]; if (ex) addExtra({ id: ex.id, name: ex.n, kind: ex.kind, db: ex.db }); else { const found = state.data.sessions.flatMap(s => s.exercises || []).find(x => x.id === el.dataset.id); if (found) addExtra({ id: found.id, name: found.name, kind: found.kind, db: !!found.db }); } break; }
    case "addCustom": {
      const name = $("#cx-name").value.trim(); if (!name) { toast("Give it a name first."); break; }
      const kind = $("#cx-kind").value, db = $("#cx-db").checked;
      if ($("#cx-lib").checked) {
        const focus = [...document.querySelectorAll("#cx-focus [aria-pressed=true]")].map(b => b.dataset.v);
        save("library", slug(name), { name, focus, equip: guessEquip(name), kind, db, notes: "" });
        addExtra({ id: `lib-${slug(name)}`, name, kind, db, focus });
      } else addExtra({ id: `custom-${slug(name)}`, name, kind, db });
      break;
    }
    case "saveCardio": saveCardio(false); render(); break;
    case "skipCardio": saveCardio(true); render(); break;
    case "editCardio": state.editing.add(editKey(LU(), LD(), "cardio")); render(); break;
    case "editCheckin": state.editing.add(editKey(LU(), LD(), "checkin")); render(); break;
    case "scale": {
      const k = checkinDraft(); k.recovery[el.dataset.k] = +el.dataset.n; store.set(`twp-k-${LU()}-${LD()}`, k);
      el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b === el)); break;
    }
    case "saveCheckin": saveCheckin(); render(); break;
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
    case "timerSet": state.timer.total = state.timer.left = +el.dataset.n; state.timer.done = false; store.set("twp-rest", +el.dataset.n); if (state.timer.running) state.timer.endAt = Date.now() + state.timer.left * 1000; drawTimer(); break;
    case "timerAdd": { const t = state.timer; t.left = Math.max(0, t.left + +el.dataset.n); t.total = Math.max(t.total, t.left); if (t.running) t.endAt = Date.now() + t.left * 1000; drawTimer(); break; }
    case "timerGo": runTimer(); break;
    case "export": exportData(); break;
  }
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
  } else if (el.dataset.act === "pickerQ") {
    state.pickerQ = el.value; const pos = el.selectionStart; drawPicker();
    const q = $("#picker-q"); q.focus(); q.setSelectionRange(pos, pos);
  }
});
document.addEventListener("change", e => {
  const el = e.target; const act = el.dataset.act;
  if (act === "progEx") { state.progEx = el.value; render(); }
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
connect((name, docs, fromCache, pending) => {
  state.data[name] = docs; state.flags[name] = { fromCache, pending };
  if ((name === "settings" || name === "sessions") && !state.userTouchedSel) state.sel = null;
  if (name === "sessions") consolidate();
  updateSync();
  const busy = state.overlay || document.activeElement?.matches?.("input, textarea, select");
  if (!busy && !renderQueued) { renderQueued = true; requestAnimationFrame(() => { renderQueued = false; render(); }); }
}, status => { state.error = status.state === "error" ? status.message : null; updateSync(); if (state.error) render(); });

render();
if ("serviceWorker" in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").catch(() => {});
  // When a new version installs, reload once so both phones run the same code.
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadController && !state.overlay) location.reload(); });
}
