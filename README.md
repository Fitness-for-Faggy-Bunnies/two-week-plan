# Two-Week Split

Benny and Mat's Monday–Thursday workout plan and tracker. It runs on GitHub Pages and saves workouts to Firebase, so both phones stay in sync.

## What it does

**At the gym (Workout tab)**
- Today's plan for each person, with Standard, Harder and Swap versions of every exercise. Each version has instructions and form videos.
- Log sets right on the exercise card: weight, reps, and how each set felt (Easy / Right / Hard), pre-filled from last time. Changing set 1 fills the sets after it.
- **Save exercise** after each one. It checks off and stays filled in for the day; tap Log to change it.
- **+ Add an exercise**: anything from the plan, the gym library, or a new machine.
- **Library** swap: pick a machine from the gym library that works the same areas as the planned exercise.
- Cardio (with Mat's bike commute) and the check-in (pain, sleep, energy, soreness, notes) each save on their own.
- "Last time" numbers and automatic weight-bump prompts.
- A rest timer that shows the between-set stretches for the exercise, then buzzes and beeps.
- Partner mode: one phone logs both people.
- Works offline once installed. Anything logged without signal syncs later.

**Gym library (Gym tab)**
- 56 built-in dumbbell exercises (in `js/library.js`), plus anything you add. Machines get added here later.
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

## Files

| File | What's in it |
| --- | --- |
| `js/plan.js` | The exercises, profiles, stretches, and cardio program. Edit this to change the plan. |
| `js/library.js` | The built-in exercise library and its tags. |
| `js/stats.js` | Progress math: best sets, weight-bump rules, reports. |
| `js/app.js` | Screens and buttons. |
| `js/firebase.js` | Database connection and Firebase config. |
| `css/styles.css` | Look and feel. |
| `sw.js` | Offline support. |

### Changing the plan
Edit `js/plan.js` on GitHub. Keep each exercise's `id` the same, since logged history is matched by id. After any change, open `sw.js` and bump `VERSION` (for example `twp-v1` → `twp-v2`) so installed phones pick up the update.

## Setup (already done once)
1. Firebase project with Firestore and Anonymous sign-in turned on.
2. Firestore rules allow reads and writes only for signed-in users:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
3. GitHub Pages: repo **Settings → Pages → Deploy from a branch → `main` / root**.

The Firebase config in `js/firebase.js` is meant to be public. Access is controlled by the rules above.

## Installing on a phone
- **iPhone:** open the site in Safari → Share → Add to Home Screen.
- **Android:** open it in Chrome → ⋮ menu → Install app.
