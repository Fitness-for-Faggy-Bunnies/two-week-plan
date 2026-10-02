// Accessibility: per-person options, quick presets, screen-reader announcements, speech,
// visual alerts, and focus management for re-renders and pop-up windows.
// Options are saved to the person's profile (so they follow them to any phone) and cached on
// this phone (so they apply on the sign-in screen too).

const CACHE = "twp-a11y";

export const DEFAULTS = {
  // Seeing
  textSize: "m",        // s m l xl xxl xxxl
  bold: false,          // heavier text everywhere
  contrast: "system",   // system | normal | high  ("system" follows the phone's Increase Contrast setting)
  bigTargets: false,    // every button at least 52px tall
  underline: false,     // underline every link
  focusRing: false,     // thick focus outline, always visible
  colorSafe: false,     // color-blind-safe colors plus symbols on selected buttons
  // Reading
  font: "theme",        // theme | atkinson | lexend | dyslexic | system
  spacing: 0,           // 0 normal, 1 roomy, 2 extra roomy (letters, words, lines)
  plain: false,         // no italics, no ALL CAPS, no stretched letters, left-aligned
  readAloud: false,     // "Read aloud" buttons on exercises and stretches
  // Hearing
  flash: false,         // screen flashes gently for timer countdowns and endings
  captions: false,      // video links look for captioned videos first
  vibrate: true,        // vibrate with timers (Android; iPhone browsers can't vibrate)
  // Blind / low vision
  speak: false,         // timers talk: 3, 2, 1, go, halfway, 10 seconds, time's up
  // Focus & memory
  focusMode: false,     // one step at a time on the Workout tab
  autoRest: false,      // checking off a set starts the rest timer
  toastTime: 4,         // seconds messages stay up (0 = until tapped)
  calm: false,          // no confetti, no celebration sounds
  // Motion
  motion: "system"      // system | reduce | full
};

export const LABELS = {
  textSize: { s: "Small", m: "Normal", l: "Large", xl: "Extra large", xxl: "Huge", xxxl: "Biggest" },
  font: { theme: "Theme's font", atkinson: "Atkinson Hyperlegible", lexend: "Lexend", dyslexic: "OpenDyslexic", system: "Phone's font" },
  spacing: { 0: "Normal", 1: "Roomy", 2: "Extra roomy" },
  contrast: { system: "Match my phone", normal: "Normal", high: "High contrast" },
  motion: { system: "Match my phone", reduce: "Reduce motion", full: "Full motion" },
  toastTime: { 4: "4 seconds", 10: "10 seconds", 0: "Until I tap it" }
};

// Quick setups: each turns on a group of options. They add to what's on; they never turn things off.
export const PRESETS = {
  lowVision: { label: "Low vision", icon: "🔍", set: { textSize: "xl", bold: true, contrast: "high", bigTargets: true, underline: true, focusRing: true, font: "atkinson", readAloud: true } },
  blind: { label: "Blind / screen reader", icon: "🦯", set: { speak: true, focusRing: true, bigTargets: true, autoRest: false, motion: "reduce", calm: true } },
  deaf: { label: "Deaf / hard of hearing", icon: "👂", set: { flash: true, captions: true, vibrate: true, toastTime: 10 } },
  dyslexia: { label: "Dyslexia", icon: "🔤", set: { font: "dyslexic", spacing: 1, plain: true, readAloud: true, toastTime: 10 } },
  adhd: { label: "ADHD / focus", icon: "🎯", set: { focusMode: true, autoRest: true, calm: true, toastTime: 10, plain: true } },
  colorBlind: { label: "Color blindness", icon: "🎨", set: { colorSafe: true, underline: true } },
  motion: { label: "Motion sensitivity", icon: "🌀", set: { motion: "reduce", calm: true } },
  motor: { label: "Limited hand movement", icon: "✋", set: { bigTargets: true, autoRest: true, toastTime: 0, focusRing: true } }
};

let current = { ...DEFAULTS };
export const get = () => current;
// The newer of this phone's copy and the profile's copy wins (_t is when it was last changed).
// who: the person using this phone. A cached copy from a different person is ignored once we know who it is.
let who = null;
export function load(profileA11y, person = null) {
  let cached = {};
  try { cached = JSON.parse(localStorage.getItem(CACHE) || "{}"); } catch { /* storage blocked */ }
  if (person && cached._who && cached._who !== person) cached = {};
  who = person || cached._who || null;
  const prof = profileA11y || {};
  current = (prof._t || 0) > (cached._t || 0) ? { ...DEFAULTS, ...cached, ...prof } : { ...DEFAULTS, ...prof, ...cached };
  delete current._who;
  cache();
  return current;
}
function cache() { try { localStorage.setItem(CACHE, JSON.stringify({ ...current, _who: who })); } catch { /* storage blocked */ } }
export function set(patch) { current = { ...current, ...patch, _t: Date.now() }; cache(); apply(); return current; }
export function reset() { current = { ...DEFAULTS, _t: Date.now() }; cache(); apply(); return current; }
export function applyPreset(id) {
  const p = PRESETS[id]; if (!p) return current;
  const patch = {};
  for (const [k, v] of Object.entries(p.set)) {
    if (typeof v === "boolean") { if (v) patch[k] = true; }
    else if (k === "textSize") { const order = Object.keys(LABELS.textSize); if (order.indexOf(v) > order.indexOf(current.textSize)) patch[k] = v; }
    else if (k === "spacing") patch[k] = Math.max(current.spacing, v);
    else if (k === "toastTime") patch[k] = current.toastTime === 0 ? 0 : v === 0 ? 0 : Math.max(current.toastTime, v);
    else patch[k] = v;
  }
  return set(patch);
}

const mq = q => { try { return matchMedia(q).matches; } catch { return false; } };
export const reduceMotion = () => current.motion === "reduce" || (current.motion === "system" && mq("(prefers-reduced-motion: reduce)"));
export const highContrast = () => current.contrast === "high" || (current.contrast === "system" && mq("(prefers-contrast: more)"));

const SIZES = { s: "15px", m: "16px", l: "18px", xl: "20px", xxl: "24px", xxxl: "28px" };
export function apply() {
  const b = document.body, a = current;
  document.documentElement.style.fontSize = SIZES[a.textSize] || "16px";
  b.dataset.font = a.font;
  b.dataset.spacing = String(a.spacing || 0);
  b.dataset.contrast = highContrast() ? "high" : "normal";
  b.dataset.motion = reduceMotion() ? "reduce" : "full";
  const flags = ["bold", "bigTargets", "underline", "focusRing", "colorSafe", "plain"];
  for (const f of flags) b.classList.toggle(`a11y-${f}`, !!a[f]);
  // "Big layout": rows wrap and headings scale down a little, so nothing runs off the side of the screen.
  const rank = Object.keys(SIZES).indexOf(a.textSize);
  const wide = a.font === "dyslexic" || a.font === "lexend" || a.bold;
  b.classList.toggle("a11y-big-text", rank >= 3 || a.spacing >= 2 || (rank >= 2 && (a.spacing >= 1 || wide)) || (a.spacing >= 1 && wide));
  b.classList.toggle("a11y-huge-text", rank >= 4 || (rank >= 3 && (a.spacing >= 1 || wide)));
}

// ---------------------------------------------------------------- announcements & speech
// Screen readers hear what goes into these hidden live regions. "assertive" is for timers.
function region(id, level) {
  let el = document.getElementById(id);
  if (!el) { el = document.createElement("div"); el.id = id; el.className = "visually-hidden"; el.setAttribute("aria-live", level); el.setAttribute("aria-atomic", "true"); document.body.appendChild(el); }
  return el;
}
export function announce(text, urgent = false) {
  const el = region(urgent ? "sr-alert" : "sr-status", urgent ? "assertive" : "polite");
  el.textContent = ""; setTimeout(() => { el.textContent = text; }, 40);
}
let voice = null;
export function speak(text, force = false) {
  if (!(force || current.speak) || !("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    if (!voice) voice = speechSynthesis.getVoices().find(v => /^en/i.test(v.lang) && v.localService) || null;
    if (voice) u.voice = voice;
    u.rate = 1; u.volume = 1;
    if (!force) speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch { /* speech unavailable */ }
}
export const canSpeak = () => "speechSynthesis" in window;
export function stopSpeaking() { try { speechSynthesis.cancel(); } catch { /* none */ } }
export function readAloud(text) { stopSpeaking(); speak(text, true); }

// A gentle full-screen color pulse for people who can't hear the beeps. One pulse per event,
// never more than one per second, so it's safe for photosensitive users. Reduced motion: a still banner.
export function flash(text = "", strong = false) {
  if (!current.flash) return;
  let el = document.getElementById("flash-alert");
  if (!el) { el = document.createElement("div"); el.id = "flash-alert"; el.setAttribute("aria-hidden", "true"); document.body.appendChild(el); }
  el.textContent = text;
  el.className = ""; void el.offsetWidth;
  el.className = `${strong ? "strong" : ""} ${reduceMotion() ? "still" : "pulse"}`;
  clearTimeout(el._t); el._t = setTimeout(() => { el.className = ""; }, reduceMotion() ? 1400 : 900);
}
export function buzz(pattern) { if (current.vibrate) navigator.vibrate?.(pattern); }

// ---------------------------------------------------------------- timers talk, flash and buzz
const NUM = { 3: "3", 2: "2", 1: "1" };
if (typeof document !== "undefined") document.addEventListener("twp-timer", e => {
  const { what, n, label } = e.detail;
  if (what === "count") { speak(NUM[n]); flash(String(n)); buzz(40); if (n === 3) announce(`${label ? label + ". " : ""}Starting in 3`, true); }
  if (what === "go") { speak("Go"); flash("GO", true); buzz(120); announce("Go", true); }
  if (what === "half") { speak("Halfway"); announce("Halfway"); }
  if (what === "ten") { speak("10 seconds"); announce("10 seconds left", true); }
  if (what === "done") { buzz([180, 120, 180, 120, 180, 120, 180, 120, 180]); speak(label ? `Time's up. ${label} done.` : "Time's up."); flash("DONE", true); announce(label ? `Time's up. ${label} done.` : "Time's up.", true); }
  if (what === "paused") announce("Timer paused");
  if (what === "stopped") announce("Timer stopped");
});

// ---------------------------------------------------------------- focus: keep your place when the screen redraws
let lastSig = null;
const sigOf = el => {
  if (!el || el === document.body) return null;
  const card = el.closest("[data-ex]"), set = el.closest("[data-s]"), tmr = el.closest("[data-tkey]");
  return { id: el.id || "", act: el.dataset?.act || "", v: el.dataset?.v || el.dataset?.u || el.dataset?.n || "", f: el.dataset?.f || "", ex: card?.dataset.ex || "", s: set?.dataset.s || "", t: tmr?.dataset.tkey || "", view: el.dataset?.view || "", tag: el.tagName };
};
if (typeof document !== "undefined") document.addEventListener("focusin", e => { const s = sigOf(e.target); if (s) lastSig = s; });
function findBySig(root, s) {
  if (!s) return null;
  if (s.id) { const el = document.getElementById(s.id); if (el && root.contains(el)) return el; }
  let scope = root;
  if (s.ex) scope = root.querySelector(`[data-ex="${CSS.escape(s.ex)}"]`) || root;
  if (s.s) scope = scope.querySelector(`[data-s="${CSS.escape(s.s)}"]`) || scope;
  const sel = s.act ? `[data-act="${CSS.escape(s.act)}"]` + (s.v ? `[data-v="${CSS.escape(s.v)}"],[data-act="${CSS.escape(s.act)}"][data-u="${CSS.escape(s.v)}"],[data-act="${CSS.escape(s.act)}"][data-n="${CSS.escape(s.v)}"]` : "")
    : s.f ? `input[data-f="${CSS.escape(s.f)}"]` : s.view ? `[data-view="${CSS.escape(s.view)}"]` : "";
  if (!sel) return null;
  return scope.querySelector(sel) || (s.act ? scope.querySelector(`[data-act="${CSS.escape(s.act)}"]`) : null);
}
// Call after the main view redraws. If focus fell off the page, put it back on the same control.
export function restoreFocus(root) {
  decorate(root);
  const a = document.activeElement;
  if (a && a !== document.body && document.contains(a)) return;
  const el = findBySig(root, lastSig);
  if (el) el.focus({ preventScroll: true });
}
// Links that open a new tab say so to screen readers.
export function decorate(root) {
  // Side-scrolling tables can be reached and scrolled with a keyboard.
  root.querySelectorAll(".scroll:not([tabindex])").forEach(el => {
    const h = el.closest("section, .card, details")?.querySelector("h2, h3, summary");
    el.tabIndex = 0; el.setAttribute("role", "region"); el.setAttribute("aria-label", (h?.textContent?.trim() || "Table") + " (scrolls sideways)");
  });
  root.querySelectorAll('a[target="_blank"]:not([data-nt])').forEach(a => {
    a.dataset.nt = "1"; const s = document.createElement("span"); s.className = "visually-hidden"; s.textContent = " (opens in a new tab)"; a.appendChild(s);
  });
}

// ---------------------------------------------------------------- pop-up windows (dialogs)
// Moves focus in, keeps Tab inside, closes on Escape, hides the page behind from screen readers,
// and puts focus back where you were when it closes.
let opener = null, wasOpen = false, openName = "";
const dlgName = d => d.getAttribute("aria-label") || d.getAttribute("aria-labelledby") || "";
let openerSig = null;
function focusStart(dlg) {
  const target = dlg.querySelector("h2, h3, .eyebrow") || dlg.querySelector("button, [href], input, select");
  if (!target) return;
  if (!target.matches("button, [href], input, select")) target.tabIndex = -1;
  target.focus({ preventScroll: true });
}
export function watchOverlay(host, background, onEscape) {
  const sync = () => {
    const dlg = host.querySelector(".overlay");
    // A different window replacing the current one (Settings → Accessibility) counts as newly opened.
    if (dlg && wasOpen && dlgName(dlg) !== openName) { openName = dlgName(dlg); focusStart(dlg); decorate(dlg); return; }
    if (dlg && !wasOpen) {
      wasOpen = true; openName = dlgName(dlg);
      const ae = document.activeElement; opener = ae && ae !== document.body ? ae : null; openerSig = sigOf(ae);
      dlg.setAttribute("aria-modal", "true");
      background.forEach(el => { el.inert = true; el.setAttribute("aria-hidden", "true"); });
      focusStart(dlg);
      decorate(dlg);
    } else if (dlg) {
      dlg.setAttribute("aria-modal", "true"); decorate(dlg);
      if (!dlg.contains(document.activeElement)) { const el = findBySig(dlg, lastSig) || dlg.querySelector("button"); el?.focus({ preventScroll: true }); }
    } else if (!dlg && wasOpen) {
      wasOpen = false;
      background.forEach(el => { el.inert = false; el.removeAttribute("aria-hidden"); });
      // Back to whatever opened it (or the same control, if the page redrew meanwhile).
      requestAnimationFrame(() => {
        const main = document.getElementById("main");
        const el = opener && document.contains(opener) && !opener.closest("[inert]") ? opener : findBySig(main, openerSig);
        el?.focus({ preventScroll: true });
        opener = null;
      });
    }
  };
  new MutationObserver(sync).observe(host, { childList: true });
  document.addEventListener("keydown", e => {
    const dlg = host.querySelector(".overlay"); if (!dlg) return;
    if (e.key === "Escape") { e.preventDefault(); onEscape(); return; }
    if (e.key !== "Tab") return;
    const items = [...dlg.querySelectorAll('button:not([disabled]):not([hidden]), [href], input:not([disabled]):not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"])')].filter(el => el.offsetParent !== null || el === document.activeElement);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || !dlg.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

// ---------------------------------------------------------------- charts get a text version
export function chartTable(canvas, config, title) {
  const labels = config.data?.labels || []; const ds = config.data?.datasets || [];
  if (!canvas || !labels.length || !ds.length) return;
  const name = title || canvas.getAttribute("aria-label") || "Chart";
  canvas.setAttribute("role", "img");
  const lastVals = ds.map(d => { const v = [...d.data].reverse().find(x => x != null && x !== ""); return v != null ? `${d.label}: latest ${Math.round(+v * 10) / 10}` : null; }).filter(Boolean);
  canvas.setAttribute("aria-label", `${name}. ${labels.length} points from ${labels[0]} to ${labels[labels.length - 1]}. ${lastVals.join(". ")}. A table version follows.`);
  const box = canvas.closest(".chart-box") || canvas.parentElement;
  box.parentElement.querySelector(`details.chart-table[data-for="${canvas.id}"]`)?.remove();
  const d = document.createElement("details"); d.className = "chart-table"; d.dataset.for = canvas.id;
  const cell = v => (v == null || v === "" ? "—" : typeof v === "number" ? String(Math.round(v * 10) / 10) : String(v));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  d.innerHTML = `<summary>Show this chart as a table</summary><div class="scroll" tabindex="0" role="region" aria-label="${esc(name)} table"><table class="t"><caption class="visually-hidden">${esc(name)}</caption><thead><tr><th scope="col">Date</th>${ds.map(x => `<th scope="col">${esc(x.label)}</th>`).join("")}</tr></thead><tbody>${labels.map((l, i) => `<tr><th scope="row">${esc(l)}</th>${ds.map(x => `<td class="num">${esc(cell(x.data[i]))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  box.after(d);
}

// Video searches: optionally only videos with captions (YouTube's CC filter).
export const ytParams = () => (current.captions ? "&sp=EgIoAQ%253D%253D" : "");
