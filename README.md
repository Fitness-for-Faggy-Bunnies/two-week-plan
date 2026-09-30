# Two-Week Split

Benny and Mat's Monday–Thursday workout plan and tracker. It runs on GitHub Pages and saves workouts to Firebase, so both phones stay in sync.

## What it does

**At the gym**
- Today's plan for each person, with Standard and Harder versions of each exercise. Benny defaults to Harder, Mat to Standard.
- "Last time" numbers on every exercise, and automatic weight-bump prompts when you hit the top of the rep range twice in a row.
- A rest timer that shows the between-set stretches for the exercise, then buzzes and beeps when time's up.
- Form videos and stretch videos for every exercise.
- Partner mode: one phone logs both people.
- Works offline once installed. Anything logged without signal syncs later.

**Logging (after the workout)**
- Sets, weight, reps, and how each set felt (Easy / Right / Hard), pre-filled from last time.
- Cardio (machine, minutes, distance, heart rate, intervals) and Mat's bike commute.
- Pain check (foot, knees, shoulders, lower back), sleep, energy, soreness, and notes.

**Progress**
- A chart and history for every exercise, weekly sets per focus area, cardio, resting heart rate, and pain.
- Body tab: weight (with a trend line), waist, hips, chest, thigh, arm, resting heart rate, VO2 max, and how clothes fit.
- End-of-cycle report every two weeks: what went up, what stalled, and what hurt, plus a summary to paste into Claude for plan adjustments.
- Before & after: compare any two dates.

## Files

| File | What's in it |
| --- | --- |
| `js/plan.js` | The exercises, profiles, stretches, and cardio program. Edit this to change the plan. |
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
