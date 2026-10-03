// Line icons (Lucide, stroke 1.75) used across the app, as inline SVG strings. Decorative unless given a label.
const P = {
  workout: ["M6.5 6.5v11", "M17.5 6.5v11", "M3 9v6", "M21 9v6", "M6.5 12h11"],
  progress: ["M22 7 13.5 15.5 8.5 10.5 2 17", "M16 7h6v6"],
  body: ["M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", "M12 8v6", "M8 22l4-8 4 8", "M6 11h12"],
  crew: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  gym: ["M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8", "M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"],
  settings: ["M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z", "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"],
  flame: ["M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"],
  pulse: ["M3 12h4l3-8 4 16 3-8h4"],
  chevron: ["m6 9 6 6 6-6"],
  x: ["M18 6 6 18", "m6 6 12 12"],
  check: ["M5 12.5l4.5 4.5L19 7.5"],
  star: ["M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"]
};
export function icon(name, size = 24, opts = {}) {
  const sw = opts.stroke || (name === "check" ? 3 : 1.75);
  return `<svg class="ico ico-${name}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${opts.fill || "none"}" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name].map(d => `<path d="${d}"/>`).join("")}</svg>`;
}
export const play = (size = 18) => `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>`;
// The logo's ears, drawn in hot pink.
export const ears = (w = 26, h = 20) => `<svg class="brand-mark" width="${w}" height="${h}" viewBox="0 0 90 70" fill="none" stroke="#fb40ad" stroke-width="4" stroke-linecap="round" aria-hidden="true"><path d="M36 68 C22 46 20 14 30 4 C40 14 44 44 42 68"/><path d="M48 68 C48 44 52 16 64 8 C72 20 64 48 54 68"/></svg>`;
