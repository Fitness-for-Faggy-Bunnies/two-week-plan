// Every timer in the app runs through here, so they all behave the same:
// 3-2-1-go countdown (4 beeps), the timed part, then exactly 5 beeps at the end. No looping alarm.
// One timer runs at a time. The volume slider shows next to every timer and is remembered on this phone.

const VOL_KEY = "twp-vol";
let ctx = null, master = null, wake = null, tick = null;
let scheduled = [], endBeeps = [];
let active = null; // { key, total, phase: "count" | "run" | "paused" | "done", runAt, endAt, left }

export function getVol() {
  try { const v = localStorage.getItem(VOL_KEY); return v == null ? 0.8 : Math.min(1, Math.max(0, +v)); } catch { return 0.8; }
}
export function setVol(v) {
  v = Math.min(1, Math.max(0, +v || 0));
  try { localStorage.setItem(VOL_KEY, String(v)); } catch { /* storage blocked */ }
  if (master) master.gain.value = v;
  document.querySelectorAll("[data-tvol]").forEach(el => { if (+el.value !== v) el.value = v; });
  document.querySelectorAll(".tmr-vol-icon").forEach(el => { el.textContent = volIcon(v); });
}
const volIcon = v => (v === 0 ? "🔇" : v < 0.4 ? "🔈" : v < 0.75 ? "🔉" : "🔊");

// iPhone: ask for "transient" audio (short alert-style sounds that duck music) so beeps aren't treated
// as background page audio. Supported on iOS 16.4+; ignored elsewhere.
try { if (navigator.audioSession && navigator.audioSession.type !== "transient") navigator.audioSession.type = "transient"; } catch { /* not supported */ }

function audioOn() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state !== "running") ctx.resume?.().catch(() => {});
    if (!master) { master = ctx.createGain(); master.connect(ctx.destination); }
    master.gain.value = getVol();
  } catch { ctx = null; }
  return ctx;
}
// Called inside a tap: wake the audio up and play one silent sample, which is what iPhones need to allow sound later.
function unlockAudio() {
  if (!audioOn()) return;
  try { const b = ctx.createBuffer(1, 1, 22050), src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination); src.start(0); } catch { /* ignore */ }
}
export const audioBlocked = () => !ctx || ctx.state !== "running";
function beep(at, freq, len, list = scheduled) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = "square"; o.frequency.value = freq; o.connect(g); g.connect(master);
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.35, at + 0.01);
  g.gain.setValueAtTime(0.35, at + len - 0.03); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.start(at); o.stop(at + len + 0.02);
  list.push(o);
}
// Beeps play when they're due (driven by the timer's own clock), not pre-scheduled when you tap Start.
// If the phone suspended the audio in between, it's resumed first, and the beep waits for it.
function play(kind) {
  if (!audioOn()) return;
  const go = () => {
    const t = ctx.currentTime + 0.02;
    if (kind === "count") beep(t, 660, 0.15);
    else if (kind === "go") beep(t, 1320, 0.4);
    else if (kind === "end") for (let i = 0; i < 5; i++) beep(t + i * 0.3, 990, 0.18, endBeeps);
    else if (kind === "test") beep(t, 990, 0.2);
  };
  if (ctx.state === "running") go();
  else ctx.resume?.().then(go).catch(() => {});
}
const stopAllIn = list => list.forEach(o => { try { o.stop(); } catch { /* already stopped */ } });
function cancelSound() { stopAllIn(scheduled); stopAllIn(endBeeps); scheduled = []; endBeeps = []; }
export function testSound() { unlockAudio(); play("test"); setTimeout(paintAudioWarn, 400); }

const lockScreen = () => navigator.wakeLock?.request("screen").then(w => { wake = w; }).catch(() => {});
const unlockScreen = () => { wake?.release?.().catch(() => {}); wake = null; };

export const isActive = key => active?.key === key && active.phase !== "done";
export const state = key => (active?.key === key ? active : null);

// Other parts of the app (speech, screen flashes, screen-reader announcements) listen for these.
const emit = (what, extra = {}) => document.dispatchEvent(new CustomEvent("twp-timer", { detail: { key: active?.key, label: active?.label || "", what, ...extra } }));
const labelFor = key => document.querySelector(`.tmr[data-tkey="${CSS.escape(key)}"]`)?.dataset.tlabel || "";

export function start(key, seconds, label = labelFor(key)) {
  seconds = Math.max(1, Math.round(+seconds || 0));
  stopAll();
  const now = Date.now();
  active = { key, label, total: seconds, phase: "count", runAt: now + 3000, endAt: now + 3000 + seconds * 1000, left: seconds, said: {} };
  unlockAudio();
  lockScreen();
  setTimeout(paintAudioWarn, 500);
  clearInterval(tick); tick = setInterval(step, 50); step();
  paint();
}
// Pausing during the countdown cancels it. Resuming runs the countdown again, then picks up where it left off.
export function toggle(key, seconds) {
  if (active?.key === key && (active.phase === "count" || active.phase === "run")) {
    if (active.phase === "count") { stop(key); return; }
    active.left = Math.max(0, (active.endAt - Date.now()) / 1000);
    active.phase = "paused"; cancelSound(); clearInterval(tick); unlockScreen(); paint(); emit("paused"); return;
  }
  if (active?.key === key && active.phase === "paused") { const total = active.total, left = active.left, label = active.label; start(key, left, label); active.total = total; paint(); return; }
  start(key, seconds);
}
export function stop(key, byUser = false) { if (!key || active?.key === key) { if (byUser && active && active.phase !== "done") emit("stopped"); stopAll(); } }
function stopAll() {
  const k = active?.key; cancelSound(); clearInterval(tick); unlockScreen(); active = null;
  if (k) paintKey(k, null);
}
// Add or take away time (rest timer ±15). Works during the countdown, while running, or paused.
export function adjust(key, delta) {
  if (active?.key !== key || active.phase === "done") return false;
  if (active.phase === "paused") { active.left = Math.max(1, active.left + delta); active.total = Math.max(active.total, active.left); paint(); return true; }
  const now = Date.now();
  const left = Math.max(1, (active.endAt - Math.max(now, active.runAt)) / 1000 + delta);
  active.endAt = Math.max(now, active.runAt) + left * 1000;
  active.total = Math.max(active.total + Math.max(0, delta), left);
  if (active.phase === "run") active.left = left;
  paint(); return true;
}

function step() {
  if (!active) return;
  const now = Date.now();
  const said = active.said;
  if (active.phase === "count") {
    const n = Math.ceil((active.runAt - now) / 1000);
    if (n >= 1 && n <= 3 && !said[`c${n}`]) { said[`c${n}`] = 1; play("count"); emit("count", { n }); }
    if (now >= active.runAt) { active.phase = "run"; if (!said.go) { said.go = 1; play("go"); emit("go"); } }
  }
  if (active.phase === "run") {
    active.left = Math.max(0, (active.endAt - now) / 1000);
    if (active.total >= 20 && active.left <= active.total / 2 && !said.half && active.left > 11) { said.half = 1; emit("half"); }
    if (active.total > 40 && active.left <= 30 && !said.thirty && active.left > 11) { said.thirty = 1; emit("thirty"); }
    if (active.total > 15 && active.left <= 10 && !said.ten && active.left > 0) { said.ten = 1; emit("ten"); }
    if (active.left <= 0) {
      active.phase = "done"; clearInterval(tick); unlockScreen();
      const key = active.key;
      setTimeout(() => { if (!active || active.phase === "done") { scheduled = []; endBeeps = []; } }, 2000);
      play("end"); paint(); emit("done");
      document.dispatchEvent(new CustomEvent("twp-timer-done", { detail: { key } }));
      return;
    }
  }
  paint();
}

const fmt = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
function view(t, seconds) {
  if (!t) return { clock: fmt(seconds), btn: "Start", cls: "", pct: 100 };
  if (t.phase === "count") { const n = Math.ceil((t.runAt - Date.now()) / 1000); return { clock: n > 0 ? String(n) : "GO", btn: "Cancel", cls: "counting", pct: 100 }; }
  if (t.phase === "run") return { clock: t.runAt > Date.now() - 600 ? "GO" : fmt(t.left), btn: "Pause", cls: "running", pct: (t.left / t.total) * 100 };
  if (t.phase === "paused") return { clock: fmt(t.left), btn: "Resume", cls: "paused", pct: (t.left / t.total) * 100 };
  return { clock: "Done", btn: "Again", cls: "done", pct: 0 };
}
function paintKey(key, t) {
  document.querySelectorAll(`.tmr[data-tkey="${CSS.escape(key)}"]`).forEach(el => {
    const v = view(t, +el.dataset.tsec);
    el.classList.remove("counting", "running", "paused", "done"); if (v.cls) el.classList.add(v.cls);
    const c = el.querySelector(".tmr-clock"); if (c && c.textContent !== v.clock) c.textContent = v.clock;
    const b = el.querySelector("[data-act=tGo]"); if (b && b.textContent !== v.btn) { b.textContent = v.btn; b.setAttribute("aria-label", `${v.btn} timer${el.dataset.tlabel ? ": " + el.dataset.tlabel : ""}`); }
    const r = el.querySelector("[data-act=tReset]"); if (r) r.hidden = !t;
    const bar = el.querySelector(".tmr-bar > i"); if (bar) bar.style.width = `${Math.max(0, Math.min(100, v.pct))}%`;
  });
}
const paint = () => { if (active) paintKey(active.key, active); };

// The timer as HTML. Safe to re-render at any time: it always reflects the running timer for its key.
// from: optional selector (inside the same [data-ex] card) of an input holding the seconds, e.g. a set's seconds box.
// Shows the "no sound" note on any timer on screen while the phone is blocking audio.
function paintAudioWarn() {
  const blocked = audioBlocked() || getVol() === 0;
  document.querySelectorAll(".tmr-warn").forEach(el => {
    el.hidden = !blocked;
    el.textContent = getVol() === 0 ? "Timer volume is all the way down." : "No sound is getting through. Turn off Silent mode (Control Center bell, or the Action button), turn the volume up, then tap Test sound.";
  });
}
export function html(key, seconds, label = "", from = "") {
  const t = state(key); const v = view(t, seconds); const vol = getVol();
  const al = label ? `: ${esc(label)}` : "";
  return `<div class="tmr ${v.cls}" data-tkey="${esc(key)}" data-tsec="${seconds}" data-tlabel="${esc(label)}" role="group" aria-label="Timer${al}"${from ? ` data-tfrom="${esc(from)}"` : ""}>
    <div class="tmr-main">
      ${label ? `<span class="tmr-label">${esc(label)}</span>` : ""}
      <span class="tmr-clock mono" role="timer" aria-label="Time left">${v.clock}</span>
      <button type="button" class="btn small primary" data-act="tGo" aria-label="${v.btn} timer${al}">${v.btn}</button>
      <button type="button" class="btn small" data-act="tReset" aria-label="Reset timer${al}" ${t ? "" : "hidden"}>Reset</button>
    </div>
    <div class="tmr-bar" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, v.pct))}%"></i></div>
    <div class="tmr-vol"><label class="tmr-vol-l"><span class="tmr-vol-icon" aria-hidden="true">${volIcon(vol)}</span><span class="visually-hidden">Timer volume</span>
      <input type="range" min="0" max="1" step="0.05" value="${vol}" data-tvol></label><button type="button" class="btn small" data-act="tTest">Test sound</button></div>
    <p class="tmr-warn small" role="status" hidden>No sound is getting through. Turn off Silent mode (Control Center bell, or the Action button), turn the volume up, then tap Test sound.</p>
  </div>`;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Buttons and the volume slider work on their own, wherever a timer is drawn.
document.addEventListener("click", e => {
  const b = e.target.closest(".tmr [data-act]"); if (!b) return;
  const el = b.closest(".tmr"); const key = el.dataset.tkey;
  e.stopPropagation();
  syncSeconds(el);
  if (b.dataset.act === "tGo") {
    const wasCounting = active?.key === key && active.phase === "count";
    if (active?.key === key && active.phase === "done") start(key, +el.dataset.tsec); else toggle(key, +el.dataset.tsec);
    if (wasCounting) document.dispatchEvent(new CustomEvent("twp-timer", { detail: { key, what: "stopped" } }));
  }
  if (b.dataset.act === "tReset") stop(key, true);
  if (b.dataset.act === "tTest") testSound();
}, true);
// Read the seconds from the linked input (if any), so editing a set's seconds changes its timer right away.
export const syncCard = card => card?.querySelectorAll(".tmr[data-tfrom]").forEach(syncSeconds);
function syncSeconds(el) {
  const src = el.dataset.tfrom && el.closest("[data-ex]")?.querySelector(el.dataset.tfrom);
  const v = src ? Math.round(+src.value) : 0;
  if (v > 0 && v !== +el.dataset.tsec) { el.dataset.tsec = v; if (!state(el.dataset.tkey)) paintKey(el.dataset.tkey, null); }
}
document.addEventListener("input", e => {
  const card = e.target.closest?.("[data-ex]");
  if (card && e.target.matches("input[data-f]")) card.querySelectorAll(".tmr[data-tfrom]").forEach(syncSeconds);
  if (!e.target.matches?.("[data-tvol]")) return;
  setVol(e.target.value);
  if (!active || active.phase === "done" || active.phase === "paused") { unlockAudio(); play("test"); }
  paintAudioWarn();
});
document.addEventListener("change", e => { if (e.target.matches?.("[data-tvol]")) e.stopPropagation(); }, true);

// Bring the screen lock back when the app returns to the front mid-timer.
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && active && (active.phase === "count" || active.phase === "run")) { lockScreen(); ctx?.resume?.().catch(() => {}); } });
