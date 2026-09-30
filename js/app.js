// Two-Week Split — app shell, views and events.
import { PROFILES, PLAN, STRETCH, CARDIO, DAYS, DAY_NAMES, ALL_EX, FOCUS, PAIN_AREAS, variantDef, defaultVariant } from "./plan.js";
import * as S from "./stats.js";
import { connect, save, remove, newId, importAll } from "./firebase.js";

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

let toastTimer;
function toast(msg) {
  let t = $(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 3200);
}

// ---------------------------------------------------------------- state
const state = {
  user: store.get("twp-user", null),
  partner: store.get("twp-partner", false),
  view: store.get("twp-view", "today"),
  viewUser: null,
  sel: null,
  variants: store.get("twp-variants", {}),
  data: { sessions: [], body: [], activities: [], settings: [] },
  flags: {}, error: null,
  logTab: null,
  progTab: "lifts", progEx: null,
  bodyField: "weight",
  repTab: "cycle", repCycle: null, cmpA: null, cmpB: null,
  confirmDel: null,
  timer: null,
  charts: []
};
if (!["mat", "benny"].includes(state.user)) state.user = null;

const cycleStart = () => state.data.settings.find(s => s.id === "app")?.cycleStart || "2026-09-28";

function autoSel() {
  const t = TODAY(); const dow = new Date().getDay();
  if (dow >= 1 && dow <= 4) return { week: S.cycleInfo(t, cycleStart()).week, day: DAYS[dow - 1] };
  const nextMon = S.addDays(t, dow === 0 ? 1 : 8 - dow);
  return { week: S.cycleInfo(nextMon, cycleStart()).week, day: "Mon" };
}
const variantOf = (u, ex) => state.variants[`${u}:${ex.id}`] || defaultVariant(ex, u);

// ---------------------------------------------------------------- drafts (a log in progress lives on this phone until saved)
const draftKey = u => `twp-draft-${u}`;
const getDraft = u => store.get(draftKey(u), null);
const putDraft = (u, d) => { d.touched = true; store.set(draftKey(u), d); };

function prefillSets(u, ex, v) {
  const def = variantDef(ex, v);
  const last = S.lastTime(state.data.sessions, u, ex.id, v);
  if (last && last.sets?.length) return last.sets.map(s => ({ w: s.w || 0, r: s.r || 0, d: 2 }));
  const { sets, min, max } = S.parseRange(def.sr);
  const start = PROFILES[u].start[v === "hard" ? `${ex.id}:hard` : ex.id] ?? 0;
  const r = def.kind === "time" ? (min || 30) : (max || min || 10);
  return Array.from({ length: sets || 3 }, () => ({ w: start, r, d: 2 }));
}
function exEntry(u, ex, v) {
  const def = variantDef(ex, v);
  const fresh = !S.lastTime(state.data.sessions, u, ex.id, v);
  return { id: ex.id, variant: v, name: v === "swap" && ex.swap ? `${ex.n} → ${ex.swap}` : def.name, kind: def.kind, db: def.db, skipped: false, fresh, sets: prefillSets(u, ex, v) };
}
function makeDraft(u, week, day) {
  const plan = PLAN[week][day]; const cp = CARDIO[u].plan(week, day);
  return {
    user: u, date: TODAY(), week, day, touched: false,
    exercises: plan.ex.map(ex => exEntry(u, ex, variantOf(u, ex))),
    cardio: { done: false, type: cp.type, minutes: 25, miles: "", avgHr: "", hiit: !!cp.hiit },
    commute: { on: false, miles: PROFILES[u].commute.miles || 0 },
    pain: Object.fromEntries(PROFILES[u].pain.map(a => [a, 0])),
    recovery: { sleep: 0, energy: 0, soreness: 0 },
    notes: ""
  };
}
function draftFromSession(s) {
  return {
    id: s.id, user: s.user, date: s.date, week: s.week, day: s.day, touched: true,
    exercises: (s.exercises || []).map(e => ({ ...e, sets: e.sets?.length ? e.sets : prefillSets(s.user, ALL_EX[e.id] || { id: e.id, sr: "3 × 10", kind: e.kind }, e.variant || "std") })),
    cardio: { done: false, type: "", minutes: 25, miles: "", avgHr: "", hiit: false, ...(s.cardio || {}) },
    commute: { on: !!state.data.activities.find(a => a.id === `${s.user}-${s.date}-commute`), miles: PROFILES[s.user].commute.miles || 0 },
    pain: { ...Object.fromEntries(PROFILES[s.user].pain.map(a => [a, 0])), ...(s.pain || {}) },
    recovery: { sleep: 0, energy: 0, soreness: 0, ...(s.recovery || {}) },
    notes: s.notes || ""
  };
}
const logUsers = () => (state.partner ? [state.user, other(state.user)] : [state.user]);

// ---------------------------------------------------------------- render
function render() {
  const main = $("#main");
  document.body.dataset.user = state.user || "";
  destroyCharts();
  if (!state.user) {
    $("#tabs").classList.add("hidden"); $("#who").classList.add("hidden");
    main.innerHTML = `<section class="pick"><h2>Who's training?</h2>
      <button class="btn mat" data-act="pickUser" data-u="mat">Mat</button>
      <button class="btn benny" data-act="pickUser" data-u="benny">Benny</button>
      <p class="muted small">You can switch any time from the name button at the top.</p></section>`;
    return;
  }
  $("#tabs").classList.remove("hidden");
  const who = $("#who"); who.classList.remove("hidden"); who.textContent = PROFILES[state.user].name + (state.partner ? " + " + PROFILES[other(state.user)].name : "");
  document.querySelectorAll("#tabs button").forEach(b => { if (b.dataset.view === state.view) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  if (!state.sel) state.sel = autoSel();
  if (!state.viewUser) state.viewUser = state.user;
  const banner = state.error ? `<div class="banner" role="alert">${esc(state.error)}</div>` : "";
  const views = { today: viewToday, log: viewLog, progress: viewProgress, body: viewBody, report: viewReport };
  main.innerHTML = banner + (views[state.view] || viewToday)();
  afterRender();
}

function personToggle() {
  return `<div class="seg" role="group" aria-label="Whose data">${["mat", "benny"].map(u => `<button data-act="viewUser" data-u="${u}" aria-pressed="${state.viewUser === u}">${PROFILES[u].name}</button>`).join("")}</div>`;
}
function seg(act, current, opts, label) {
  return `<div class="seg" role="group" aria-label="${esc(label || act)}">${opts.map(([v, l]) => `<button data-act="${act}" data-v="${v}" aria-pressed="${current === v}">${esc(l)}</button>`).join("")}</div>`;
}

// ---------------------------------------------------------------- TODAY
function viewToday() {
  const u = state.user, p = PROFILES[u];
  const { week, day } = state.sel; const plan = PLAN[week][day];
  const ci = S.cycleInfo(TODAY(), cycleStart());
  const draftNote = logUsers().some(x => getDraft(x)?.touched) ? `<p class="small muted">You have an unsaved log in progress. Open the Log tab to finish it.</p>` : "";
  return `
  <section class="card">
    <div class="between"><span class="eyebrow">${ci.week === week ? "This week is" : "Viewing"} Week ${week}</span><span class="small muted">Cycle started ${S.fmtDate(ci.start)}</span></div>
    ${seg("selWeek", week, [["A", "Week A"], ["B", "Week B"]], "Week")}
    <div class="chips" role="group" aria-label="Day">${DAYS.map(d => `<button data-act="selDay" data-v="${d}" aria-pressed="${d === day}">${d}<small>${esc(PLAN[week][d].title.split(",")[0])}</small></button>`).join("")}</div>
    <h2 class="h2">${DAY_NAMES[day]} · ${esc(plan.title)}</h2>
    <details class="more"><summary>${esc(p.name)}'s focus and notes</summary><div class="panel"><p>${esc(p.focusNote)}</p><ul class="small">${p.notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul></div></details>
    ${draftNote}
  </section>
  ${cardioPlanCard(u, week, day)}
  ${plan.ex.map(ex => exCard(ex, u)).join("")}
  <div class="sticky-cta"><button class="btn primary block" data-act="startLog">Log this workout${state.partner ? " for both" : ""}</button></div>`;
}

function cardioPlanCard(u, week, day) {
  const cp = CARDIO[u].plan(week, day);
  const partner = state.partner ? CARDIO[other(u)].plan(week, day) : null;
  return `<section class="card cardio-card">
    <div class="between"><h3 class="h3">Cardio · ${esc(cp.type)}</h3>${cp.hiit ? `<span class="tag new">Intervals</span>` : ""}</div>
    <p>${esc(cp.text)}</p>
    ${partner ? `<p class="small muted"><b>${PROFILES[other(u)].name}:</b> ${esc(partner.type)}. ${esc(partner.text)}</p>` : ""}
  </section>`;
}

function exCard(ex, u) {
  const v = variantOf(u, ex); const def = variantDef(ex, v);
  const last = S.lastTime(state.data.sessions, u, ex.id, v);
  const sug = S.suggestion(state.data.sessions, u, ex.id, v);
  const pu = other(u), pv = variantOf(pu, ex), plast = state.partner ? S.lastTime(state.data.sessions, pu, ex.id, pv) : null;
  const why = v === "hard" && ex.h ? ex.h.how : ex.why;
  const note = ex.notes?.[u];
  return `<article class="card ex">
    <div class="head"><div class="name">${esc(def.name)}<span class="tag ${ex.tag}">${ex.tag === "orig" ? "Original" : "New"}</span></div><span class="sr">${esc(def.sr)}</span></div>
    ${ex.h ? seg("variant", v, [["std", "Standard"], ["hard", "Harder"]], "Version").replace(/data-act="variant"/g, `data-act="variant" data-ex="${ex.id}"`) : ""}
    <div class="why">${esc(why)}</div>
    ${note ? `<div class="note">${esc(note)}</div>` : ""}
    <div class="last">${last ? `Last time (${S.fmtDate(last.date)}): <b>${esc(S.describeSets(last.kind, last.db, last.sets))}</b>` : "No history yet for this version."}</div>
    ${state.partner ? `<div class="last">${PROFILES[pu].name}${pv !== v ? ` (${VARIANT_LABEL[pv].toLowerCase()})` : ""}: ${plast ? `<b>${esc(S.describeSets(plast.kind, plast.db, plast.sets))}</b>` : "no history yet"}</div>` : ""}
    ${sug ? `<div class="pill ${sug.type}">${esc(sug.text)}</div>` : ""}
    <div class="row"><button class="btn small" data-act="timer" data-ex="${ex.id}">Rest timer + stretches</button></div>
    <details class="more"><summary>Form, video &amp; stretches</summary>${exPanel(ex)}</details>
  </article>`;
}

function exPanel(ex) {
  const stretches = ex.s.map(k => stretchBox(k)).join("");
  return `<div class="panel">
    <div><h4>How to do it</h4><p>${esc(ex.setup)}</p><a class="video" href="${yt(ex.q)}" target="_blank" rel="noopener">Watch form videos</a></div>
    ${ex.h ? `<div><h4>Harder option · ${esc(ex.h.n)} · ${esc(ex.h.sr)}</h4><p>${esc(ex.h.how)}</p><a class="video" href="${yt(ex.h.q)}" target="_blank" rel="noopener">Watch form videos</a></div>` : ""}
    ${ex.swap ? `<div><h4>If it bothers you</h4><p><b>Swap:</b> ${esc(ex.swap)}</p></div>` : ""}
    ${ex.v ? `<div><h4>More lunge types to rotate in</h4><div class="panel">${ex.v.map(x => `<div class="stretch"><b>${esc(x.n)}</b><p>${esc(x.h)}</p><a href="${yt(x.q)}" target="_blank" rel="noopener">Video</a></div>`).join("")}</div></div>` : ""}
    <div><h4>Between sets, while your partner's up</h4><div class="panel">${stretches}</div></div>
  </div>`;
}
function stretchBox(k) {
  const s = STRETCH[k];
  return `<div class="stretch"><b>${esc(s.n)}<span>${esc(s.t)}</span></b><p>${esc(s.h)}</p><a href="${ytStretch(s.n)}" target="_blank" rel="noopener">See it done</a></div>`;
}

// ---------------------------------------------------------------- LOG
function viewLog() {
  const users = logUsers();
  if (!users.some(u => getDraft(u))) {
    const { week, day } = state.sel;
    return `<section class="card"><h2 class="h2">Log a workout</h2>
      <p class="muted">Nothing in progress. Start a log for Week ${week} ${DAY_NAMES[day]} (${esc(PLAN[week][day].title)}), or pick another day on the Today tab first.</p>
      <button class="btn primary block" data-act="startLog">Start log for ${DAY_NAMES[day]}</button></section>`;
  }
  if (!state.logTab || !users.includes(state.logTab)) state.logTab = users[0];
  const u = state.logTab; let d = getDraft(u);
  const tabs = users.length > 1 ? `<section class="card"><span class="eyebrow">Partner mode · both logs save together</span>${seg("logTab", u, users.map(x => [x, PROFILES[x].name + (getDraft(x) ? "" : " (not started)")]), "Person")}</section>` : "";
  if (!d) return tabs + `<section class="card"><p>No log started for ${PROFILES[u].name}.</p><button class="btn primary" data-act="startLogFor" data-u="${u}">Start ${PROFILES[u].name}'s log</button></section>`;
  const sel = state.sel; const mismatch = !d.id && (d.week !== sel.week || d.day !== sel.day);
  return `${tabs}
  <div id="log" data-u="${u}" style="display:grid;gap:16px">
  <section class="card">
    <div class="between"><h2 class="h2">${d.id ? "Edit" : "Log"} · ${PROFILES[u].name}</h2><span class="small muted">Week ${d.week} · ${DAY_NAMES[d.day]}</span></div>
    ${mismatch ? `<div class="banner">This log is for Week ${d.week} ${DAY_NAMES[d.day]}, but Today shows Week ${sel.week} ${DAY_NAMES[sel.day]}. <button class="btn small" data-act="restartLog">Start ${DAY_NAMES[sel.day]} instead</button></div>` : ""}
    <label class="field">Date<input type="date" id="log-date" data-f="date" value="${esc(d.date)}"></label>
    <p class="small muted">Everything is pre-filled from last time. Adjust what changed, mark how each set felt, and save.</p>
  </section>
  ${d.exercises.map((e, i) => logExCard(u, e, i)).join("")}
  ${logCardio(u, d)}
  ${logPain(u, d)}
  ${logRecovery(d)}
  <section class="card"><label class="field">Notes<textarea id="log-notes" data-f="notes" placeholder="Anything worth remembering: new machine, felt off, a win.">${esc(d.notes)}</textarea></label></section>
  <div class="sticky-cta row" style="flex-wrap:nowrap"><button class="btn primary block" data-act="saveLog">${users.length > 1 && users.every(x => getDraft(x)) ? "Save both workouts" : "Save workout"}</button></div>
  <button class="btn danger" data-act="discardLog">${state.confirmDel === "draft" ? "Tap again to discard this log" : `Discard ${PROFILES[u].name}'s log`}</button>
  </div>`;
}

function logExCard(u, e, i) {
  const ex = ALL_EX[e.id];
  const def = ex ? variantDef(ex, e.variant) : { sr: "" };
  const opts = [["std", "Standard"]]; if (ex?.h) opts.push(["hard", "Harder"]); if (ex?.swap) opts.push(["swap", "Swap"]);
  const last = S.lastTime(state.data.sessions, u, e.id, e.variant);
  const sug = S.suggestion(state.data.sessions, u, e.id, e.variant);
  return `<section class="card log-ex ${e.skipped ? "skipped" : ""}" data-e="${i}">
    <div class="between"><label class="check"><input type="checkbox" data-act="skip" ${e.skipped ? "" : "checked"}><span>${esc(e.name)}</span></label><span class="mono small">${esc(def.sr)}</span></div>
    ${opts.length > 1 ? seg("logVariant", e.variant, opts, "Version") : ""}
    <div class="last">${last ? `Last time (${S.fmtDate(last.date)}): <b>${esc(S.describeSets(last.kind, last.db, last.sets))}</b>` : "First time logging this version."}</div>
    ${sug ? `<div class="pill ${sug.type}">${esc(sug.text)}</div>` : ""}
    ${e.fresh && !e.skipped ? `<div class="pill hold fresh-note">New for you. Set what you actually did. If you leave it untouched, it won't be saved.</div>` : ""}
    <div class="sets">${e.sets.map((s, si) => setRow(e, s, si)).join("")}</div>
    <div class="row add-set"><button class="btn small" data-act="addSet">+ Add set</button><button class="btn small" data-act="timer" data-ex="${e.id}">Rest timer</button></div>
  </section>`;
}
function setRow(e, s, si) {
  const u = S.unitLabel(e.kind, e.db);
  const wStep = 5, rStep = e.kind === "time" ? 5 : e.kind === "carry" ? 5 : 1;
  return `<div class="set ${u.w ? "" : "noweight"}" data-s="${si}">
    <span class="n">${si + 1}</span>
    ${u.w ? stepper("w", s.w, u.w, wStep) : ""}
    ${stepper("r", s.r, u.r, rStep)}
    <div class="diff" role="group" aria-label="How set ${si + 1} felt">${[1, 2, 3].map(d => `<button type="button" data-act="diff" data-d="${d}" aria-pressed="${(s.d || 2) === d}">${DIFF[d]}</button>`).join("")}<button type="button" class="del" data-act="delSet" aria-label="Remove set ${si + 1}">×</button></div>
  </div>`;
}
function stepper(f, val, label, step) {
  return `<div><div class="stepper"><button type="button" data-act="step" data-f="${f}" data-by="${-step}" aria-label="Less">−</button><input type="number" inputmode="decimal" step="any" data-f="${f}" value="${esc(val)}" aria-label="${esc(label)}"><button type="button" data-act="step" data-f="${f}" data-by="${step}" aria-label="More">+</button></div><div class="stepper-label">${esc(label)}</div></div>`;
}
function logCardio(u, d) {
  const c = d.cardio; const cp = CARDIO[u].plan(d.week, d.day);
  return `<section class="card cardio-card">
    <label class="check"><input type="checkbox" data-f="cardio.done" ${c.done ? "checked" : ""}><span class="h3">Cardio done</span></label>
    <p class="small">${esc(cp.text)}</p>
    <div class="grid2">
      <label class="field">Machine<select data-f="cardio.type">${CARDIO[u].options.map(o => `<option ${o === c.type ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></label>
      <label class="field">Minutes<input type="number" inputmode="numeric" data-f="cardio.minutes" value="${esc(c.minutes)}"></label>
      <label class="field">Distance (miles)<input type="number" inputmode="decimal" step="any" data-f="cardio.miles" value="${esc(c.miles)}" placeholder="optional"></label>
      <label class="field">Average heart rate<input type="number" inputmode="numeric" data-f="cardio.avgHr" value="${esc(c.avgHr)}" placeholder="optional"></label>
    </div>
    <label class="check"><input type="checkbox" data-f="cardio.hiit" ${c.hiit ? "checked" : ""}><span>Intervals (HIIT)</span></label>
    ${PROFILES[u].commute.enabled ? `<hr style="border:0;border-top:1px dashed var(--plate);width:100%">
      <label class="check"><input type="checkbox" data-f="commute.on" ${d.commute.on ? "checked" : ""}><span>I biked to work today</span></label>
      <label class="field">Round-trip miles<input type="number" inputmode="decimal" step="any" data-f="commute.miles" value="${esc(d.commute.miles)}"></label>` : ""}
  </section>`;
}
function logPain(u, d) {
  return `<section class="card"><h3 class="h3">Pain check</h3><p class="small muted">0 is nothing, 10 is stop-everything. Log it even when it's zero, so healing shows up on the chart.</p>
    ${PROFILES[u].pain.map(a => `<div class="pain-row"><span>${PAIN_AREAS[a]}</span><input type="range" min="0" max="10" step="1" data-f="pain.${a}" value="${+d.pain[a] || 0}" aria-label="${PAIN_AREAS[a]} pain"><span class="mono" data-out="pain.${a}">${+d.pain[a] || 0}</span></div>`).join("")}
  </section>`;
}
function logRecovery(d) {
  const row = (k, l, lo, hi) => `<div class="field"><span>${l} <span class="small">(1 ${lo} · 5 ${hi})</span></span><div class="scale" role="group" aria-label="${l}">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-act="scale" data-k="${k}" data-n="${n}" aria-pressed="${+d.recovery[k] === n}">${n}</button>`).join("")}</div></div>`;
  return `<section class="card"><h3 class="h3">How you feel</h3>${row("sleep", "Sleep last night", "awful", "great")}${row("energy", "Energy", "drained", "strong")}${row("soreness", "Soreness", "none", "very")}</section>`;
}

function saveLog() {
  const users = logUsers().filter(u => getDraft(u));
  for (const u of users) {
    const d = getDraft(u);
    const id = d.id || newId("sessions");
    save("sessions", id, {
      user: u, date: d.date, week: d.week, day: d.day,
      exercises: d.exercises.filter(e => !e.fresh).map(e => ({ id: e.id, variant: e.variant, name: e.name, kind: e.kind, db: !!e.db, skipped: !!e.skipped, sets: e.skipped ? [] : e.sets.map(s => ({ w: +s.w || 0, r: +s.r || 0, d: +s.d || 2 })) })),
      cardio: { ...d.cardio, minutes: +d.cardio.minutes || 0, miles: d.cardio.miles === "" ? null : +d.cardio.miles, avgHr: d.cardio.avgHr === "" ? null : +d.cardio.avgHr },
      pain: Object.fromEntries(Object.entries(d.pain).map(([k, v]) => [k, +v || 0])),
      recovery: d.recovery, notes: d.notes || ""
    });
    const cid = `${u}-${d.date}-commute`;
    if (d.commute?.on) save("activities", cid, { user: u, date: d.date, type: "Bike commute", miles: +d.commute.miles || 0 });
    else if (state.data.activities.find(a => a.id === cid)) remove("activities", cid);
    store.del(draftKey(u));
  }
  toast(navigator.onLine ? `Saved ${users.map(u => PROFILES[u].name).join(" and ")}'s workout.` : "Saved on this phone. It will sync when you're back online.");
  state.view = "today"; store.set("twp-view", "today"); render(); scrollTo(0, 0);
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
  for (const s of S.userSessions(state.data.sessions, u)) for (const e of s.exercises || []) if (!e.skipped) out.set(`${e.id}|${e.variant || "std"}`, e.name);
  return out;
}
const displayScore = (kind, sets) => kind === "load" ? Math.round(S.bestScore(kind, sets)) : kind === "carry" ? Math.max(...sets.map(s => s.w || 0)) : S.bestScore(kind, sets);
const scoreLabel = kind => ({ load: "Estimated max (lb)", carry: "Heaviest carry (lb)", assist: "Assist used (lb, lower is better)", time: "Longest hold (sec)", bw: "Most reps in a set" })[kind];

function progLifts() {
  const u = state.viewUser; const logged = loggedKeys(u);
  if (!state.progEx || !(logged.has(state.progEx) || ALL_EX[state.progEx.split("|")[0]])) state.progEx = logged.keys().next().value || `${PLAN.A.Mon.ex[0].id}|std`;
  const [id, v] = state.progEx.split("|");
  const ex = ALL_EX[id]; const def = variantDef(ex, v);
  const loggedOpts = [...logged.entries()].map(([k, n]) => `<option value="${k}" ${k === state.progEx ? "selected" : ""}>${esc(n)}${k.endsWith("|hard") ? " (harder)" : k.endsWith("|swap") ? " (swap)" : ""}</option>`).join("");
  const planOpts = Object.values(ALL_EX).filter(e => !logged.has(`${e.id}|std`)).map(e => `<option value="${e.id}|std" ${`${e.id}|std` === state.progEx ? "selected" : ""}>${esc(e.n)} · ${e.week} ${e.day}</option>`).join("");
  const h = S.exHistory(state.data.sessions, u, id, v);
  const sug = S.suggestion(state.data.sessions, u, id, v);
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
      <div class="stat"><div class="v ${pct > 0 ? "good" : pct < 0 ? "bad" : ""}">${pct == null ? "—" : (pct > 0 ? "+" : "") + pct + "%"}</div><div class="l">Since first log</div></div></div>`;
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
  return `<section class="card"><h3 class="h3">Pain over time</h3>${ss.length ? `<div class="chart-box"><canvas id="chart-pain"></canvas></div>` : `<p class="muted">Pain checks from your logs show up here.</p>`}
    <p class="small muted">A line trending down means healing. A spike after a certain day points at the exercise to swap. The end-of-cycle report lists which exercises you did on high-pain days.</p></section>`;
}
function progHistory() {
  const u = state.viewUser; const ss = S.userSessions(state.data.sessions, u).reverse();
  if (!ss.length) return `<section class="card"><p class="muted">No workouts logged yet.</p></section>`;
  return `<section class="card">${ss.slice(0, 60).map(s => {
    const n = (s.exercises || []).filter(e => !e.skipped).length;
    const del = state.confirmDel === s.id;
    return `<div class="list-item"><div><b>${S.fmtDate(s.date)}</b> · Week ${esc(s.week)} ${esc(s.day)}<div class="small muted">${n} exercises${s.cardio?.done ? ` · ${esc(s.cardio.type)} ${s.cardio.minutes || 0} min` : ""}</div></div>
      <div class="row">${u === state.user || state.partner ? `<button class="btn small" data-act="editSession" data-id="${s.id}">Edit</button>` : ""}<button class="btn small danger" data-act="delSession" data-id="${s.id}">${del ? "Confirm" : "Delete"}</button></div></div>`;
  }).join("")}</section>`;
}

// ---------------------------------------------------------------- BODY
function viewBody() {
  const u = state.viewUser; const rows = state.data.body.filter(b => b.user === u).sort((a, b) => (a.date < b.date ? 1 : -1));
  const fields = Object.entries(S.BODY_FIELDS);
  const summary = fields.map(([f, m]) => {
    const xs = rows.filter(r => r[f] != null && r[f] !== "").reverse(); if (!xs.length) return "";
    const first = +xs[0][f], last = +xs[xs.length - 1][f], ch = +(last - first).toFixed(1);
    const good = S.trendClass(f, ch);
    return `<div class="stat"><div class="v">${last}${m.unit ? ` <span class="small">${m.unit}</span>` : ""}</div><div class="l">${esc(m.label)}${xs.length > 1 ? ` · <span class="${good}">${ch > 0 ? "+" : ""}${ch} since ${S.fmtDate(xs[0].date)}</span>` : ""}</div></div>`;
  }).join("");
  const charted = fields.filter(([f]) => rows.some(r => r[f] != null && r[f] !== ""));
  if (!charted.find(([f]) => f === state.bodyField) && charted.length) state.bodyField = charted[0][0];
  return `<section class="card"><div class="between"><h2 class="h2">Body</h2>${personToggle()}</div>
    ${summary ? `<div class="stats">${summary}</div>` : `<p class="muted">No entries yet. Add a first one below, as your "before".</p>`}</section>
    ${u === state.user || state.partner ? bodyForm(u) : ""}
    ${charted.length ? `<section class="card"><label class="field">Chart<select data-act="bodyField">${charted.map(([f, m]) => `<option value="${f}" ${f === state.bodyField ? "selected" : ""}>${esc(m.label)}</option>`).join("")}</select></label><div class="chart-box"><canvas id="chart-body"></canvas></div></section>` : ""}
    ${rows.length ? `<section class="card"><h3 class="h3">Entries</h3>${rows.map(r => `<div class="list-item"><div><b>${S.fmtDate(r.date)}</b><div class="small muted">${fields.filter(([f]) => r[f] != null && r[f] !== "").map(([f, m]) => `${esc(m.label)} ${r[f]}${m.unit ? " " + m.unit : ""}`).join(" · ")}</div></div><button class="btn small danger" data-act="delBody" data-id="${r.id}">${state.confirmDel === r.id ? "Confirm" : "Delete"}</button></div>`).join("")}</section>` : ""}`;
}
function bodyForm(u) {
  const fields = Object.entries(S.BODY_FIELDS);
  return `<section class="card" id="body-form"><h3 class="h3">New entry for ${PROFILES[u].name}</h3>
    <label class="field">Date<input type="date" id="body-date" value="${TODAY()}"></label>
    <div class="grid2">${fields.map(([f, m]) => `<label class="field">${esc(m.label)}${m.unit ? ` (${m.unit})` : ""}<input type="number" inputmode="decimal" step="any" data-bf="${f}"></label>`).join("")}</div>
    <details class="more"><summary>How to measure</summary><div class="panel small">
      <p><b>Weight:</b> morning, after the bathroom, before eating. Weigh a few times a week; the app smooths it into a weekly trend.</p>
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
    ${seg("repTab", state.repTab, [["cycle", "End of cycle"], ["compare", "Before & after"]], "Report type")}</section>
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
  const r = S.cycleReport({ sessions: state.data.sessions, body: state.data.body, activities: state.data.activities, user: u, start: c.start, end: c.end });
  const li = (arr, fn) => arr.length ? `<ul>${arr.map(fn).join("")}</ul>` : `<p class="muted small">None.</p>`;
  const tot = r.diff[1] + r.diff[2] + r.diff[3];
  const text = S.reportText(r);
  return `<section class="card report">
    <label class="field">Cycle<select data-act="repCycle">${list.map(x => `<option value="${x.index}" ${x.index === c.index ? "selected" : ""}>${S.fmtDate(x.start)} – ${S.fmtDate(x.end)}${x.index === list[0].index ? " (current)" : ""}</option>`).join("")}</select></label>
    <div class="stats">
      <div class="stat"><div class="v">${r.sessions}/${r.planned}</div><div class="l">Workouts</div></div>
      <div class="stat"><div class="v">${r.cardio.gymMinutes}</div><div class="l">Cardio minutes</div></div>
      <div class="stat"><div class="v">${r.cardio.hiit}</div><div class="l">Interval sessions</div></div>
      ${r.cardio.commuteDays ? `<div class="stat"><div class="v">${r.cardio.commuteMiles}</div><div class="l">Commute miles</div></div>` : ""}
    </div>
    <h3 class="good">Went up</h3>${li(r.up, x => `<li><b>${esc(x.name)}</b>: ${esc(x.before)} → ${esc(x.top)}</li>`)}
    <h3>Stalled</h3>${li(r.stalled, x => `<li><b>${esc(x.name)}</b>: best before ${esc(x.before)}, latest ${esc(x.top)}</li>`)}
    ${r.newEx.length ? `<h3>First time logged</h3>${li(r.newEx, x => `<li><b>${esc(x.name)}</b>: ${esc(x.top)}</li>`)}` : ""}
    <h3 class="bad">What hurt</h3>
    <table class="t"><thead><tr><th>Area</th><th>Average</th><th>Worst</th></tr></thead><tbody>${Object.entries(r.pain).map(([a, v]) => `<tr><td>${PAIN_AREAS[a]}</td><td class="num">${v ? v.avg : "—"}</td><td class="num">${v ? v.max : "—"}</td></tr>`).join("")}</tbody></table>
    ${r.painDays.length ? `<p class="small">Days with pain 4 or higher:</p>${li(r.painDays, d => `<li>${S.fmtDate(d.date)}: ${esc(d.areas.join(", "))}<div class="small muted">${esc(d.exercises.join(", "))}</div></li>`)}` : ""}
    ${Object.keys(r.bodyChange).length ? `<h3>Body changes</h3>${li(Object.entries(r.bodyChange), ([f, v]) => `<li>${esc(S.BODY_FIELDS[f].label)}: ${v.from} → ${v.to} ${S.BODY_FIELDS[f].unit} (<span class="${S.trendClass(f, v.change)}">${v.change > 0 ? "+" : ""}${v.change}</span>)</li>`)}` : ""}
    ${tot ? `<h3>How sets felt</h3><p class="small">${Math.round(r.diff[1] / tot * 100)}% easy · ${Math.round(r.diff[2] / tot * 100)}% just right · ${Math.round(r.diff[3] / tot * 100)}% hard</p>` : ""}
    <h3>Summary to paste to Claude</h3>
    <pre class="summary" id="summary">${esc(text)}</pre>
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
function line(label, data, color, extra = {}) { return { label, data, borderColor: color, backgroundColor: color, tension: .25, pointRadius: 3, spanGaps: true, ...extra }; }

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
  const ex = ALL_EX[exId];
  state.timer = { ex, total: store.get("twp-rest", 90), left: store.get("twp-rest", 90), running: false, endAt: 0, done: false };
  drawTimer();
}
function drawTimer() {
  const t = state.timer; if (!t) return;
  const m = Math.floor(Math.max(0, Math.ceil(t.left)) / 60), s = Math.max(0, Math.ceil(t.left)) % 60;
  $("#overlay").innerHTML = `<div class="overlay" role="dialog" aria-label="Rest timer"><div class="inner">
    <div class="between"><span class="eyebrow">Rest · ${esc(t.ex?.n || "")}</span><button class="btn small" data-act="closeOverlay">Close</button></div>
    <div class="clock ${t.done ? "done" : ""}" aria-live="polite">${t.done ? "GO" : `${m}:${String(s).padStart(2, "0")}`}</div>
    <div class="ring"><div style="width:${t.total ? Math.max(0, (t.left / t.total) * 100) : 0}%"></div></div>
    <div class="row" style="justify-content:center">${[60, 90, 120].map(n => `<button class="btn small" data-act="timerSet" data-n="${n}" aria-pressed="${t.total === n}">${n}s</button>`).join("")}
      <button class="btn small" data-act="timerAdd" data-n="-15">−15</button><button class="btn small" data-act="timerAdd" data-n="15">+15</button></div>
    <button class="btn primary block" data-act="timerGo">${t.running ? "Pause" : t.done ? "Restart" : "Start"}</button>
    <h3 class="h3">Stretch while you wait</h3>
    ${(t.ex?.s || []).map(stretchBox).join("")}
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
function closeOverlay() { clearInterval(tick); releaseWake(); state.timer = null; state.settingsOpen = false; $("#overlay").innerHTML = ""; }

function openSettings() {
  state.settingsOpen = true;
  const cs = cycleStart(); const ci = S.cycleInfo(TODAY(), cs);
  $("#overlay").innerHTML = `<div class="overlay" role="dialog" aria-label="Settings"><div class="inner">
    <div class="between"><h2 class="h2">Settings</h2><button class="btn small" data-act="closeOverlay">Close</button></div>
    <section class="card"><h3 class="h3">Who's using this phone</h3>${seg("pickUser", state.user, [["mat", "Mat"], ["benny", "Benny"]], "Person").replace(/data-v=/g, "data-u=")}
      <label class="check"><input type="checkbox" data-act="partner" ${state.partner ? "checked" : ""}><span>Partner mode: log both of us from this phone</span></label>
      <p class="small muted">Use it when one phone is dead or in a locker. The Log tab gets a tab for each person, and both workouts save together.</p></section>
    <section class="card"><h3 class="h3">Two-week cycle</h3>
      <label class="field">Week A started on (a Monday)<input type="date" data-act="cycleStart" value="${cs}"></label>
      <p class="small muted">Today is in Week ${ci.week}. This setting is shared by both of you.</p></section>
    <section class="card"><h3 class="h3">Install on your phone</h3>
      <p class="small"><b>iPhone:</b> open this page in Safari, tap Share, then Add to Home Screen.</p>
      <p class="small"><b>Android:</b> open it in Chrome, tap the ⋮ menu, then Install app.</p>
      <p class="small muted">Once installed it opens like an app and works without signal. Anything you log offline syncs when you're back online.</p></section>
    <section class="card"><h3 class="h3">Backup</h3>
      <div class="row"><button class="btn" data-act="export">Download backup</button><label class="btn">Restore backup<input type="file" accept="application/json" data-act="import" hidden></label></div>
      <p class="small muted">The backup is one file with every workout, body entry and commute for both of you.</p></section>
  </div></div>`;
}

function exportData() {
  const data = { app: "two-week-split", exportedAt: new Date().toISOString(), ...state.data };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `two-week-split-backup-${TODAY()}.json`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// ---------------------------------------------------------------- events
function currentDraftCtx(el) {
  const root = el.closest("#log"); if (!root) return null;
  const u = root.dataset.u; const d = getDraft(u);
  const exEl = el.closest("[data-e]"); const setEl = el.closest("[data-s]");
  return { u, d, ei: exEl ? +exEl.dataset.e : null, si: setEl ? +setEl.dataset.s : null };
}
function clearFresh(el) { el.closest(".log-ex")?.querySelector(".fresh-note")?.remove(); }
function setPath(obj, path, val) { const ks = path.split("."); let o = obj; for (const k of ks.slice(0, -1)) o = o[k] = o[k] || {}; o[ks[ks.length - 1]] = val; }

document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const act = el.dataset.act; const v = el.dataset.v;
  switch (act) {
    case "pickUser": {
      state.user = el.dataset.u; state.viewUser = state.user; store.set("twp-user", state.user);
      if (state.settingsOpen) closeOverlay(); render(); break;
    }
    case "selWeek": state.sel.week = v; state.userTouchedSel = true; render(); break;
    case "selDay": state.sel.day = v; state.userTouchedSel = true; render(); break;
    case "variant": state.variants[`${state.user}:${el.dataset.ex}`] = v; store.set("twp-variants", state.variants); render(); break;
    case "timer": openTimer(el.dataset.ex); break;
    case "startLog": {
      for (const u of logUsers()) { const d = getDraft(u); if (!d || !d.touched) store.set(draftKey(u), makeDraft(u, state.sel.week, state.sel.day)); }
      state.logTab = state.user; go("log"); break;
    }
    case "startLogFor": store.set(draftKey(el.dataset.u), makeDraft(el.dataset.u, state.sel.week, state.sel.day)); render(); break;
    case "restartLog": { const ctx = currentDraftCtx(el); store.set(draftKey(ctx.u), makeDraft(ctx.u, state.sel.week, state.sel.day)); render(); break; }
    case "logTab": state.logTab = v; render(); break;
    case "logVariant": {
      const c = currentDraftCtx(el); const ex = ALL_EX[c.d.exercises[c.ei].id];
      c.d.exercises[c.ei] = exEntry(c.u, ex, v); putDraft(c.u, c.d); render(); break;
    }
    case "skip": { const c = currentDraftCtx(el); c.d.exercises[c.ei].skipped = !el.checked; putDraft(c.u, c.d); el.closest(".log-ex").classList.toggle("skipped", !el.checked); break; }
    case "step": {
      const c = currentDraftCtx(el); const set = c.d.exercises[c.ei].sets[c.si]; const f = el.dataset.f;
      set[f] = Math.max(0, +(((+set[f] || 0) + +el.dataset.by)).toFixed(2)); c.d.exercises[c.ei].fresh = false; putDraft(c.u, c.d); clearFresh(el);
      el.parentElement.querySelector("input").value = set[f]; break;
    }
    case "diff": {
      const c = currentDraftCtx(el); c.d.exercises[c.ei].sets[c.si].d = +el.dataset.d; c.d.exercises[c.ei].fresh = false; putDraft(c.u, c.d); clearFresh(el);
      el.parentElement.querySelectorAll("[data-d]").forEach(b => b.setAttribute("aria-pressed", b === el)); break;
    }
    case "delSet": { const c = currentDraftCtx(el); c.d.exercises[c.ei].sets.splice(c.si, 1); c.d.exercises[c.ei].fresh = false; putDraft(c.u, c.d); render(); break; }
    case "addSet": { const c = currentDraftCtx(el); const sets = c.d.exercises[c.ei].sets; sets.push({ ...(sets[sets.length - 1] || { w: 0, r: 10 }), d: 2 }); c.d.exercises[c.ei].fresh = false; putDraft(c.u, c.d); render(); break; }
    case "scale": { const c = currentDraftCtx(el); c.d.recovery[el.dataset.k] = +el.dataset.n; putDraft(c.u, c.d); el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b === el)); break; }
    case "saveLog": saveLog(); break;
    case "discardLog": {
      if (state.confirmDel !== "draft") { state.confirmDel = "draft"; render(); break; }
      state.confirmDel = null; store.del(draftKey(state.logTab)); toast("Log discarded."); render(); break;
    }
    case "viewUser": state.viewUser = el.dataset.u; state.confirmDel = null; render(); break;
    case "progTab": state.progTab = v; render(); break;
    case "repTab": state.repTab = v; render(); break;
    case "editSession": {
      const s = state.data.sessions.find(x => x.id === el.dataset.id); if (!s) break;
      store.set(draftKey(s.user), draftFromSession(s));
      if (s.user !== state.user) state.partner = true;
      state.logTab = s.user; go("log"); break;
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
      save("body", newId("body"), entry); toast("Entry saved."); break;
    }
    case "copySummary": {
      const text = $("#summary").textContent;
      const fallback = () => { const r = document.createRange(); r.selectNodeContents($("#summary")); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast("Selected. Copy it from the menu."); };
      navigator.clipboard?.writeText(text).then(() => toast("Copied. Paste it into a chat with Claude."), fallback) || fallback();
      break;
    }
    case "closeOverlay": closeOverlay(); break;
    case "timerSet": state.timer.total = state.timer.left = +el.dataset.n; state.timer.done = false; store.set("twp-rest", +el.dataset.n); if (state.timer.running) state.timer.endAt = Date.now() + state.timer.left * 1000; drawTimer(); break;
    case "timerAdd": { const t = state.timer; t.left = Math.max(0, t.left + +el.dataset.n); t.total = Math.max(t.total, t.left); if (t.running) t.endAt = Date.now() + t.left * 1000; drawTimer(); break; }
    case "timerGo": runTimer(); break;
    case "export": exportData(); break;
  }
});

document.getElementById("tabs").addEventListener("click", e => { const b = e.target.closest("button[data-view]"); if (b) go(b.dataset.view); });
document.getElementById("who").addEventListener("click", openSettings);
document.getElementById("gear").addEventListener("click", openSettings);

function go(view) { state.view = view; state.confirmDel = null; store.set("twp-view", view); render(); scrollTo(0, 0); }

document.addEventListener("input", e => {
  const el = e.target;
  const c = currentDraftCtx(el);
  if (c && c.d && el.dataset.f) {
    const f = el.dataset.f;
    if (c.si != null && (f === "w" || f === "r")) { c.d.exercises[c.ei].sets[c.si][f] = el.value === "" ? "" : +el.value; c.d.exercises[c.ei].fresh = false; clearFresh(el); }
    else if (el.type === "checkbox") setPath(c.d, f, el.checked);
    else setPath(c.d, f, el.value);
    putDraft(c.u, c.d);
    const out = document.querySelector(`[data-out="${f}"]`); if (out) out.textContent = el.value;
  }
});
document.addEventListener("change", e => {
  const el = e.target; const act = el.dataset.act;
  if (act === "progEx") { state.progEx = el.value; render(); }
  if (act === "bodyField") { state.bodyField = el.value; render(); }
  if (act === "repCycle") { state.repCycle = +el.value; render(); }
  if (act === "cmpA") { state.cmpA = el.value; render(); }
  if (act === "cmpB") { state.cmpB = el.value; render(); }
  if (act === "partner") { state.partner = el.checked; store.set("twp-partner", state.partner); render(); }
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
  else if (f.length < 4 || f.some(x => x.fromCache)) { cls = "pending"; text = "Connecting"; }
  el.className = "sync " + cls; el.textContent = text; el.title = text; el.setAttribute("aria-label", "Sync: " + text);
}
addEventListener("online", updateSync); addEventListener("offline", updateSync);

let renderQueued = false;
connect((name, docs, fromCache, pending) => {
  state.data[name] = docs; state.flags[name] = { fromCache, pending };
  if (name === "settings" && !state.userTouchedSel) state.sel = null;
  updateSync();
  const typing = state.settingsOpen || state.timer || document.activeElement?.matches?.("input, textarea, select");
  if (!typing && !renderQueued) { renderQueued = true; requestAnimationFrame(() => { renderQueued = false; render(); }); }
}, status => { state.error = status.state === "error" ? status.message : null; updateSync(); if (state.error) render(); });

render();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
