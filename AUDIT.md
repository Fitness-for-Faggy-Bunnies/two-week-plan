# Audit — October 1, 2026

What was checked, what was fixed, and what's left. Tests: `node tests/run.mjs` (671 checks).

## Fixed

| Area | Problem | Fix |
|---|---|---|
| Data safety | Saving rewrote the whole day's record, so two phones logging the same person's day could erase each other's exercises. | Saves now merge only the fields that changed. Each exercise is stored under its own key. Tested with two simulated phones saving different exercises to the same day. |
| Data safety | Cardio switching from "biked to work" to a real session kept a stale "skipped" flag. | Cardio saves every field explicitly. |
| Data safety | The duplicate-cleanup could overwrite a save the other phone made a moment earlier. | It merges instead of overwriting. |
| Data safety | Saving a theme overwrote the whole profile. | Profile changes merge too. |
| Security rules | Any member could make themselves crew owner, change another member's role, or join as "owner". | Ownership can't change; members can only edit their own entry and can't change their role; joining with a code always makes you a regular member. |
| Accounts | Signing out left the crew's data cached on the phone for the next person. | Sign-out wipes the cached data and this app's saved drafts, then reloads. |
| Accounts | Being removed from a crew left you stuck with errors. | You're sent back to the join screen with a note. Being offline never triggers this. |
| Crews | Every new crew showed Mat and Benny. | Built-in Mat/Benny only appear in a crew that has their data, so new crews start empty. |
| Crews | Crew owner couldn't reach "Bring over old data" before picking a profile. | Button added on the first screen. |
| Solo crews | "Copy this day to…" and partner mode appeared with nobody to copy to. | Hidden until there are two people. |
| High-fives | The first high-five a phone ever got was skipped. | Fixed; a phone opening for the first time still shows one from the last 12 hours. |
| Add to plan | Person picker was hard-coded to Mat and Benny. | Uses the crew's real profiles. |
| Contrast | Some text was too faint: Synthwave and Iron & Chalk buttons, Iron & Chalk links, orange and gold text in Gym Floor and Clean Light. | Colors adjusted. Every theme now passes the 4.5:1 readability standard for text. |
| Motion | High-five animation ignored "reduce motion". | Respected now. |
| Cleanup | Unused import; site description named only Mat and Benny. | Removed / made general. |

## Checked, no problems found
- Every screen and overlay in all 5 themes, light and dark, phone (360 px) and tablet (820 px): no errors, nothing spilling off-screen.
- Progress math: estimated max, assisted machines (lower is better), carries, dumbbell volume (both hands), records, weight-bump prompts, "too heavy" prompts, streaks, points, levels, badges.
- Dates: Week A/B, cycles across the new year, daylight-saving changes, reports in progress vs. finished.
- Content: every plan exercise has a swap with instructions, joint ratings and injury risks for all three versions, valid stretches; every library exercise has risks with advice and a valid rep range.

## Couldn't test here
- **Security rules in a real test database.** The Firebase emulator download is blocked from this environment, so the rules were reviewed line by line instead.
- **Real-phone behavior:** Google sign-in from the iPhone home-screen app, sounds, offline sync between two phones.

## Later improvements (not urgent)
- **Free-plan reads.** Every app open reads the crew's whole history. For two people that's roughly 10,000 reads a day after a year, well under the 50,000 free limit. A crew of 10 could pass it within a year; the fix is loading recent months by default and older history on request.
- **`js/app.js` is about 1,750 lines.** Splitting it by screen would make future changes safer.
- **Small buttons** are 34 px tall; 44 px is easier to hit with sweaty fingers.
- **Vibration** doesn't work on iPhones (Apple blocks it for web apps); sound still works after you tap something.
