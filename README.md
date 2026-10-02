# Two-Week Split

Benny and Mat's Monday–Thursday workout plan and tracker. It runs on GitHub Pages and saves workouts to Firebase, so both phones stay in sync.

## What it does

**At the gym (Workout tab)**
- Today's plan with Standard, Harder, Swap and Library versions of every exercise, each with instructions, form videos, joint load and specific injury risks.
- Start workout → timer → Finish workout, with a summary: time, sets, pounds moved, personal bests.
- Warm-up for each day, with ramp-up sets for the first lift worked out from your weights.
- Log sets right on the card, pre-filled from last time. Save each exercise as you finish it.
- Exercise tiles fold up to one line (name, target, last time). The next one you haven't done opens by itself; tap any header to open or close it, or use Open all / Close all.
- Superset ideas that pair exercises using different muscles and equipment.
- Lighter weeks: suggested after 6 weeks or when lots of sets feel hard; pre-fills about 60% weight and one less set.
- Weight steps match the gym: small dumbbell steps up to a set weight, then 5 lb (Settings → Our gym). Smith bar weight noted on Smith exercises.
- Sore spots flag exercises that load what hurts today.
- Edit any day's plan: reorder, change targets, rename the day, clear it, copy it to your partner, add from the library, reset.
- Reminders for weigh-ins, measurements, resting heart rate and the end-of-cycle report.
- Rest timer with stretches, partner mode, offline support.
- A check-off box on every set, and built-in timers for timed sets and stretches. All timers count down 3-2-1-go and beep 5 times at the end, with a volume slider.
- Stretches say where you should feel them and what they do.

**Make it yours (Settings)**
- Profiles for anyone, set up in the app: goals, focus areas, aches to track, default version, cardio style, bike commute.
- Themes: Bunny (the logo's charcoal and pink, default), Gym Floor, Synthwave, Iron & Chalk, Arcade, Clean Light. Accent color, text size, avatar.
- Personality: Hype, Chill or Just the numbers. Fun level: Light (record celebrations, badges), Medium (+ streaks, progress ring, finish screen, high-fives), Full (+ points, levels, weekly leaderboard).

**Gym library (Gym tab)**
- 56 built-in dumbbell exercises and our gym's 23 purple machines (in `js/library.js`), plus anything you add. Machines come with setup tips; MTS machines note that each arm moves on its own.
- Plan exercises show "At our gym" buttons that switch to the matching machine in one tap.
- Each one is tagged with equipment, focus, movement (push, pull, squat, hinge, lunge, carry…), position, difficulty, effort, impact, one-side-at-a-time, joint load on eight areas, and specific injury risks with how to avoid them.
- Filter by any of those, search, and sort by name, difficulty, effort or impact.
- Sore spots: tap what aches today and exercises that load it heavily are hidden or flagged, here and in swaps.
- Add any exercise to today, or to Mat's, Benny's or both plans on any week and day. Remove planned exercises from a day on the Workout tab ("Edit this day's plan").
- Library swaps rank by same movement, then same focus, and keep sore spots in mind.
- Edit or hide any built-in exercise; your version is saved in the database and wins.

**Progress**
- A chart and history for every exercise, weekly sets per focus area, cardio, resting heart rate, and pain.
- Body tab: weight (with a trend line), waist, hips, chest, thigh, arm, resting heart rate, VO2 max, and how clothes fit.
- End-of-cycle report every two weeks: what went up, what stalled, and what hurt, plus a summary to paste into Claude for plan adjustments.
- Before & after: compare any two dates.

**Accessibility (Settings → Accessibility, also on the sign-in screen)**
- Quick setups: Low vision, Blind / screen reader, Deaf / hard of hearing, Dyslexia, ADHD / focus, Color blindness, Motion sensitivity, Limited hand movement. Each turns on a group of the options below.
- Seeing: six text sizes (up to 28 px base), high contrast (or match the phone's Increase Contrast), bold text, bigger buttons (52 px+), underlined links, strong focus outline, color-blind-safe colors with symbols.
- Reading: Atkinson Hyperlegible, Lexend or OpenDyslexic fonts (bundled, work offline), roomier letter/word/line spacing, plain text style (no italics or ALL CAPS), read-aloud buttons on exercises and stretches.
- Hearing: gentle screen flash for timer countdowns and endings (never more than once a second), captioned-video links, vibration.
- Screen readers: every control labeled, pop-up windows trap focus and close with Escape, focus stays put when the screen redraws, timers announce 3-2-1-go / halfway / 10 seconds / time's up, charts have a table version, the calendar reads who trained each day, skip link.
- Focus & memory: one step at a time on the Workout tab, rest timer starts when you check off a set, messages that stay up longer (or until tapped), calm mode.
- Motion: reduce motion (or match the phone).
- Options follow the person to any phone and also apply before sign-in. Checked with axe-core (WCAG 2.2 AA) on all six themes, light and dark, with options off and on: no violations.

## Files

| File | What's in it |
| --- | --- |
| `js/plan.js` | The exercises, profiles, stretches, and cardio program. Edit this to change the plan. |
| `js/library.js` | The built-in exercise library and its tags. |
| `js/safety.js` | Joint load and injury risks for plan exercises. |
| `js/fun.js` | Voice lines, celebrations, badges, streaks, points. |
| `js/timer.js` | Every timer: 3-2-1-go countdown, 5-beep finish, volume. |
| `js/a11y.js` | Accessibility options, presets, announcements, speech, focus handling. |
| `fonts/` | Reading fonts (Atkinson Hyperlegible, Lexend, OpenDyslexic) and their open licenses. |
| `js/stats.js` | Progress math: best sets, weight-bump rules, reports. |
| `js/app.js` | Screens and buttons. |
| `js/firebase.js` | Sign-in, crews, database connection and Firebase config. |
| `firestore.rules` | Security rules to paste into Firebase. |
| `css/styles.css` | Look and feel. |
| `sw.js` | Offline support. |
| `tests/run.mjs` | Tests for the progress math and content. Run `node tests/run.mjs`. |
| `AUDIT.md` | Latest audit: what was checked and fixed. |

### Changing the plan
Edit `js/plan.js` on GitHub. Keep each exercise's `id` the same, since logged history is matched by id. After any change, open `sw.js` and bump `VERSION` (for example `twp-v1` → `twp-v2`) so installed phones pick up the update.

## Setup
1. **Firebase → Authentication → Sign-in method:** turn on **Google** and **Email/Password**. (Anonymous can be turned off.)
2. **Firebase → Authentication → Settings → Authorized domains:** add `fitness-for-faggy-bunnies.github.io`.
3. **Firestore → Rules:** paste the contents of `firestore.rules` and publish.
4. **GitHub Pages:** repo Settings → Pages → Deploy from a branch → `main` / root.

### Crews and sign-in
- Sign in with Google, or with email + password. Forgot password sends a reset email. Settings → Account can add the other sign-in method to the same account.
- A crew is a private group with its own workouts, library and profiles. The first person creates it; others join with the 6-letter invite code from Settings → Crew.
- Settings → Crew lists each member's sign-in email, for anyone who forgets which one they used.
- Moving the first version's data: the crew owner opens Settings → Crew → "Bring over data from the first version" once, then deletes the TEMPORARY block from the rules.

The Firebase config in `js/firebase.js` is meant to be public. Access is controlled by the rules.

## Installing on a phone
- **iPhone:** open the site in Safari → Share → Add to Home Screen.
- **Android:** open it in Chrome → ⋮ menu → Install app.
