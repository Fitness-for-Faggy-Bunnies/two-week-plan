// Two-Week Split — plan data for both profiles.
// Edit this file on GitHub to change exercises. Keep each exercise `id` stable:
// logged history is matched to exercises by id.

export const PROFILES = {
  mat: {
    id: "mat",
    name: "Mat",
    focus: ["glutes", "chest", "back", "core"],
    focusNote: "Fat loss, lifted glutes, chest shape, a stronger back and core.",
    defaultVariant: "std",
    pain: ["foot", "knees", "shoulders", "lowerBack"],
    commute: { enabled: true, miles: 12.4 },
    start: { "a-mon-sp": 40 },
    notes: [
      "Squat to a bench at whatever depth your knees allow.",
      "Hold off on leg press and calf raises while the foot heals.",
      "Gym cardio is optional on bike-commute days."
    ]
  },
  benny: {
    id: "benny",
    name: "Benny",
    focus: ["core", "full", "cardio"],
    focusNote: "Midsection fat loss, long-term functional strength and bone density, low resting heart rate and higher VO2 max.",
    defaultVariant: "hard",
    pain: ["foot", "knees", "shoulders", "lowerBack"],
    commute: { enabled: false, miles: 0 },
    start: { "b-mon-sp": 25, "b-mon-sp:hard": 25 },
    notes: [
      "Harder options are the default. Tap Standard any day you want an easier session.",
      "Two interval (HIIT) cardio days a week, steady cardio on the others.",
      "Jumps and heavy carries are there for bone strength. Land softly."
    ]
  }
};

export const FOCUS = {
  chest: "Chest", shoulders: "Shoulders", arms: "Arms", back: "Back",
  core: "Core", glutes: "Glutes", legs: "Legs", calves: "Calves",
  full: "Full body", cardio: "Cardio"
};

export const PAIN_AREAS = { foot: "Foot", knees: "Knees", shoulders: "Shoulders", lowerBack: "Lower back", neck: "Neck", elbows: "Elbows", wrists: "Wrists", hips: "Hips", ankles: "Ankles" };

// n name · t how long · h how · f where you feel it · g what it does · sec hold length for the timer (0 = counted reps, no timer)
export const STRETCH = {
  chest:{n:"Chest Opener",t:"20–30 sec per side",h:"Stand tall beside a machine. Put your hand on it at shoulder height, elbow slightly bent, and slowly turn your body away until your chest stretches.",f:"Across the front of your chest and the front of the shoulder, on the side you're turning away from.",g:"Loosens the chest after pressing so your shoulders sit back instead of rounding forward. Better posture, and a better start position for your next set.",sec:30},
  crossbody:{n:"Cross-Body Shoulder",t:"20 sec per side",h:"Pull one arm across your chest with the other hand, holding just above the elbow. Keep the shoulder down, away from your ear.",f:"Back of the shoulder and the upper back, on the arm being pulled across.",g:"Releases the rear shoulder, which tightens from pressing and rowing, so the shoulder moves freely.",sec:20},
  triceps:{n:"Overhead Triceps",t:"20 sec per side",h:"Reach one hand down your upper back and gently press that elbow with the other hand. Skip it if the shoulder pinches.",f:"Back of the upper arm, from the elbow toward the armpit, and a little down your side.",g:"Relaxes the triceps after pushdowns and presses and keeps reaching overhead comfortable.",sec:20},
  neck:{n:"Neck Side Stretch",t:"15–20 sec per side",h:"Drop one ear toward that shoulder while letting the other shoulder relax down.",f:"Side of the neck and top of the shoulder, on the side away from the tilt.",g:"Lets go of the upper-trap tension that builds when you shrug during presses and raises.",sec:20},
  circles:{n:"Arm Circles",t:"10 each direction",h:"Small to medium circles forward, then backward. Keeps the shoulders warm between pressing sets.",f:"Warmth around the shoulder joint. This is a loosener, not a stretch.",g:"Keeps blood moving through the shoulder between sets so it stays warm and smooth for the next one.",sec:0},
  shrug:{n:"Shoulder Rolls",t:"10 slow rolls",h:"Roll your shoulders up, back, and down. Finish with shoulder blades gently pulled together.",f:"Tops of the shoulders and between the shoulder blades.",g:"Resets your shoulders down and back so the next set starts in good position.",sec:0},
  lat:{n:"Overhead Side Reach",t:"20 sec per side",h:"Reach one arm overhead and lean gently to the opposite side. You'll feel it along your side and back.",f:"Along the side of your body, from the armpit down toward the hip, on the reaching side.",g:"Lengthens the lats after pulling, so your arms can go overhead without your lower back arching.",sec:20},
  bicep:{n:"Biceps Wall Stretch",t:"20 sec per side",h:"Put your palm flat on a wall or machine post behind you at shoulder height, thumb up, and slowly turn away.",f:"Front of the upper arm, running into the front of the shoulder.",g:"Loosens the biceps after curls and pulls and helps the elbow straighten fully.",sec:20},
  forearm:{n:"Wrist and Forearm",t:"15 sec each way",h:"Arm straight in front, palm up, gently pull your fingers back. Then flip palm down and repeat.",f:"Palm up: underside of the forearm. Palm down: top of the forearm.",g:"Eases grip tension from dumbbells and carries, which helps protect the elbows and wrists.",sec:15},
  quad:{n:"Standing Quad",t:"20 sec per side",h:"Hold a machine for balance and pull one heel toward your butt, knees side by side. Ease off if the knee complains.",f:"Front of the thigh, from just above the knee up to the hip.",g:"Takes tension off the front of the knee after squats and lunges. Tight quads pull on the kneecap, so this is knee care.",sec:20},
  hamstring:{n:"Hamstring on a Bench",t:"20 sec per side",h:"Heel on a low bench, that leg straight. Stand tall and lean forward only from the hips until the back of the thigh stretches.",f:"Back of the thigh, between the knee and your sit bone. Not behind the knee itself.",g:"Restores hamstring length after deadlifts and leg curls, which takes strain off the lower back.",sec:20},
  fig4:{n:"Seated Figure-4",t:"20–30 sec per side",h:"Sit on a bench, cross one ankle over the other knee, sit tall, and lean forward a little. Stretches the glutes and hips.",f:"Deep in the glute and outer hip of the crossed leg.",g:"Releases the glutes and outer hip after thrusts and abductor work, so your hips move freely and your lower back doesn't take over.",sec:30},
  hipflex:{n:"Standing Hip Flexor",t:"20 sec per side",h:"Stand in a staggered stance. Squeeze the back leg's glute and tuck your hips under until the front of that hip stretches. No kneeling.",f:"Front of the hip and top of the thigh, on the back leg.",g:"Opens the hip flexors, which tighten from sitting and biking. Looser hip flexors let your glutes squeeze fully and ease the pull on your lower back.",sec:20},
  adductor:{n:"Wide-Stance Side Lean",t:"20 sec per side",h:"Feet wide, shift your weight over one leg with that knee softly bent and tracking over your toes. The straight leg's inner thigh stretches.",f:"Inner thigh of the straight leg.",g:"Loosens the inner thighs after squats, lunges and the adductor machine, and helps your knees track straight.",sec:20},
  calf:{n:"Gentle Calf Stretch",t:"20 sec per side",h:"Hands on a wall or machine, one foot back with the heel down. Go easy on an injured foot and stop if the heel or arch tightens.",f:"The calf muscle at the back of the lower leg, on the back leg. Not in the heel or the arch.",g:"Keeps the calf and Achilles flexible, which takes pressure off the foot and helps a healing tendon.",sec:20},
  ankle:{n:"Ankle Circles",t:"10 each way, each foot",h:"Sit on a bench and slowly circle each foot. Good care for a healing foot.",f:"Easy movement around the ankle. No stretch feeling.",g:"Keeps the ankle moving smoothly and brings blood flow to the foot without loading it.",sec:0},
  twist:{n:"Seated Twist",t:"20 sec per side",h:"Sit tall on a bench and turn your chest to one side, one hand on the bench behind you.",f:"Along the sides of your waist and through the middle and upper back.",g:"Restores rotation in the spine after core work and lets the obliques relax.",sec:20},
  backarch:{n:"Standing Back Extension",t:"5 slow reps",h:"Hands on your hips, squeeze your glutes, and gently lean back a small amount. Return to tall.",f:"A gentle stretch across the front of the hips and stomach. Your lower back should feel relief, never a pinch.",g:"Undoes the bent-forward position of rows, deadlifts and sitting, and resets your posture.",sec:0}
};

export const LUNGES = [
  {n:"Reverse Lunge",h:"Step back, lower until both knees are near 90 degrees, push through the front heel to return. The easiest lunge on the knees.",q:"dumbbell reverse lunge"},
  {n:"Forward Lunge",h:"Step forward, lower, then push back to standing. More demanding on the front knee.",q:"dumbbell forward lunge"},
  {n:"Walking Lunge",h:"Lunge forward and keep going, alternating legs across the floor.",q:"dumbbell walking lunge"},
  {n:"Lateral (Side) Lunge",h:"Step wide to the side and sit back into that hip, other leg straight. Works inner thighs and glutes.",q:"dumbbell lateral lunge"},
  {n:"Curtsy Lunge",h:"Step one leg back and behind the other, like a curtsy, and lower. Targets the outer glutes.",q:"dumbbell curtsy lunge"},
  {n:"Static Split Squat",h:"Stay in a split stance and lower straight down and up. Best for learning balance and form.",q:"dumbbell split squat"},
  {n:"Deficit Reverse Lunge",h:"Front foot on a low step or plate, then reverse lunge. Deeper stretch, more glute work.",q:"deficit reverse lunge dumbbell"},
  {n:"Bulgarian Split Squat",h:"Rear foot on a bench behind you, lower on the front leg. The hardest version and a big glute builder.",q:"dumbbell bulgarian split squat"},
  {n:"Goblet Lunge",h:"Any lunge above holding one dumbbell at your chest instead of two at your sides. Keeps your torso more upright.",q:"goblet reverse lunge"}
];

// Swaps: what to do instead when a machine is taken or something hurts. Same sets and reps as the standard version unless sr is given.
const W = (n, kind, how, o = {}) => ({ n, kind, how, q: o.q || n, db: !!o.db, sr: o.sr || null });
const SWAPS = {
  "a-mon-cp": W("Dumbbell Bench Press","load","Lie on a flat bench with a dumbbell in each hand over your chest. Lower to the sides of your chest and press back up.",{db:true}),
  "a-mon-inc": W("Incline Machine Press","load","Seat set so the handles start at upper-chest height. Press up and slightly forward, lower slowly.",{q:"incline chest press machine"}),
  "a-mon-sp": W("Seated Dumbbell Shoulder Press","load","Upright bench, back supported. Press dumbbells from shoulder height to overhead and lower under control.",{db:true}),
  "a-mon-lat": W("Cable Lateral Raise","load","Stand side-on to a low pulley, handle in the far hand. Raise to shoulder height and lower slowly."),
  "a-mon-push": W("Machine Tricep Extension","load","Elbows on the pad, push the handles down until your arms are straight, return slowly.",{q:"tricep extension machine"}),
  "a-mon-fly": W("Cable Crossover","load","Handles at shoulder height, step forward, bring your hands together in front of your chest with a slight elbow bend.",{q:"cable crossover chest fly"}),
  "a-tue-pd": W("Single-Arm Cable Pulldown","load","Kneel or sit under a high pulley with one handle. Pull your elbow down to your side, one arm at a time."),
  "a-tue-row": W("Seated Cable Row","load","Sit tall, feet on the platform, pull the handle to your belly and squeeze your shoulder blades.",{q:"seated cable row"}),
  "a-tue-pu": W("Close-Grip Lat Pulldown","load","V-handle on the pulldown. Pull to your upper chest with elbows close to your body.",{q:"close grip lat pulldown"}),
  "a-tue-bext": W("Lower Back Machine","load","Seated back extension machine. Lean back against the pad slowly and return with control. Keep it light.",{q:"back extension machine seated"}),
  "a-tue-rdelt": W("Cable Face Pull","load","Rope at the top pulley. Pull toward your forehead, elbows high, hands spreading apart."),
  "a-tue-curl": W("Cable Curl","load","Straight bar or rope at the low pulley. Elbows at your sides, curl up and lower slowly."),
  "a-wed-ht": W("Dumbbell Glute Bridge","load","Lie on your back, knees bent, dumbbell on your hips. Drive your hips up, squeeze, lower slowly.",{q:"dumbbell glute bridge"}),
  "a-wed-dl": W("Back Extension","bw","45-degree back extension bench. Lower slowly and rise to a straight line, squeezing your glutes.",{q:"45 degree back extension glutes"}),
  "a-wed-sq": W("Goblet Squat to a Bench","load","Hold one dumbbell at your chest, sit back to a bench, touch lightly, stand up.",{q:"goblet squat to box"}),
  "a-wed-lunge": W("Static Split Squat","load","Split stance, one hand on a machine for balance, lower straight down and up. Finish one leg, then switch.",{db:true,q:"dumbbell split squat"}),
  "a-wed-curl": W("Lying Leg Curl","load","Lie face down, pad above your heels, curl up and lower slowly.",{q:"lying leg curl machine"}),
  "a-wed-ext": W("Wall Sit","time","Back flat against a wall, slide down until your knees are bent as far as is comfortable, and hold.",{sr:"3 × 30–45 sec"}),
  "a-wed-abd": W("Cable Hip Abduction","load","Ankle strap on a low pulley, stand side-on, sweep the outside leg out and back slowly."),
  "a-thu-bug": W("Dead Bug Hold","time","Arms up, knees over hips, lower back pressed down. Hold still and breathe.",{sr:"3 × 20–30 sec"}),
  "a-thu-pallof": W("Cable Woodchop","load","Cable at shoulder height, rotate from your middle to pull the handle diagonally across your body. Both sides."),
  "a-thu-plank": W("Dead Bug Hold","time","On your back, arms up, knees over hips, lower back pressed into the floor. Hold.",{q:"dead bug hold"}),
  "a-thu-goblet": W("Leg Press, Light","load","Moderate weight, feet shoulder width, controlled reps to about 90 degrees at the knee.",{q:"leg press"}),
  "a-thu-farmer": W("Suitcase Carry","carry","One heavy dumbbell in one hand, walk tall without leaning. Switch hands each set."),
  "a-thu-calf": W("Seated Calf Raise","load","Pad on your knees, balls of feet on the platform. Lift your heels, pause, lower slowly.",{q:"seated calf raise machine"}),
  "b-mon-inc": W("Incline Machine Press","load","Seat set so the handles start at upper-chest height. Press up and slightly forward, lower slowly.",{q:"incline chest press machine"}),
  "b-mon-fly": W("Cable Crossover","load","Handles at shoulder height, step forward, bring your hands together in front of your chest.",{q:"cable crossover chest fly"}),
  "b-mon-sp": W("Machine Shoulder Press","load","Seat so handles start at shoulder level, back on the pad, press up without shrugging."),
  "b-mon-clat": W("Dumbbell Lateral Raise","load","Stand tall, slight elbow bend, raise to shoulder height and lower slowly.",{db:true}),
  "b-mon-dip": W("Cable Tricep Pushdown","load","Rope or bar at the top pulley. Elbows pinned, push down to straight arms, return slowly."),
  "b-mon-ohext": W("Overhead Dumbbell Tricep Extension","load","Seated, hold one dumbbell with both hands overhead, lower behind your head and press back up.",{q:"seated overhead dumbbell tricep extension"}),
  "b-tue-cgpd": W("Assisted Pull-Up (neutral grip)","assist","Neutral handles on the assisted machine. Pull your chest toward the handles, lower slowly.",{q:"assisted pull up machine"}),
  "b-tue-csrow": W("Seated Row Machine","load","Chest on the pad, pull the handles to your ribs, squeeze your shoulder blades."),
  "b-tue-sapd": W("Dumbbell Pullover","load","Lie across a bench holding one dumbbell over your chest with both hands. Lower it back over your head with slightly bent arms and pull it back.",{q:"dumbbell pullover"}),
  "b-tue-bext": W("Lower Back Machine","load","Seated back extension machine. Lean back slowly against the pad and return with control.",{q:"back extension machine seated"}),
  "b-tue-face": W("Reverse Pec Deck","load","Face the pad, open your arms wide at shoulder height and squeeze between your shoulder blades.",{q:"reverse pec deck rear delt"}),
  "b-tue-hammer": W("Rope Cable Hammer Curl","load","Rope at the low pulley, palms facing each other, curl up and lower slowly.",{q:"rope hammer curl cable"}),
  "b-wed-ht": W("Smith Machine Hip Thrust","load","Upper back on a bench, padded bar over your hips. Drive up through your heels and squeeze at the top."),
  "b-wed-rdl": W("Smith Machine Romanian Deadlift","load","Hold the Smith bar, soften knees, push hips back until hamstrings stretch, stand up squeezing glutes.",{q:"smith machine romanian deadlift"}),
  "b-wed-lp": W("Smith Machine Box Squat","load","Bench behind you, feet slightly forward. Sit back to the bench and stand up.",{q:"smith machine box squat"}),
  "b-wed-split": W("Goblet Reverse Lunge","load","Hold one dumbbell at your chest, step back into a lunge, push through the front heel to return.",{q:"goblet reverse lunge"}),
  "b-wed-curl": W("Lying Leg Curl","load","Lie face down, pad above your heels, curl up and lower slowly.",{q:"lying leg curl machine"}),
  "b-wed-add": W("Cable Hip Adduction","load","Ankle strap on a low pulley, stand side-on, sweep the inside leg across your body and back slowly."),
  "b-wed-abd": W("Cable Hip Abduction","load","Ankle strap on a low pulley, stand side-on, sweep the outside leg out and back slowly."),
  "b-thu-rot": W("Cable Woodchop","load","Cable at shoulder height, rotate from your middle to pull the handle diagonally across your body. Both sides."),
  "b-thu-knee": W("Lying Knee Raise","bw","Lie on a bench holding the end behind your head. Bring your knees toward your chest and lower slowly.",{q:"lying knee raise bench"}),
  "b-thu-suit": W("Farmer Carry","carry","A heavy dumbbell in each hand, walk tall with short steady steps.",{db:true,q:"farmers carry dumbbells"}),
  "b-thu-hold": W("Lower Back Machine","load","Seated back extension machine, light weight, slow reps.",{sr:"3 × 12",q:"back extension machine seated"}),
  "b-thu-goblet": W("Leg Press, Light","load","Moderate weight, feet shoulder width, controlled reps to about 90 degrees at the knee.",{q:"leg press"}),
  "b-thu-calf": W("Seated Calf Raise","load","Pad on your knees, lift your heels, pause, lower slowly.",{q:"seated calf raise machine"})
};

// kind: load (weight × reps) | bw (reps only) | time (seconds) | carry (weight × steps) | assist (assist weight × reps, lower is better)
// db: weight is per dumbbell
const X = (id, n, sr, tag, focus, kind, why, setup, s, o = {}) =>
  ({ id, n, sr, tag, focus, kind, why, setup, s, swap: SWAPS[id] || null, q: o.q || n, db: !!o.db, h: o.h || null, v: o.v || null, notes: o.notes || {} });
const H = (n, sr, kind, how, o = {}) => ({ n, sr, kind, how, q: o.q || n, db: !!o.db });

export const PLAN = {
  A: {
    Mon: { title: "Chest, Shoulders, Triceps", ex: [
      X("a-mon-cp","Machine Chest Press","3 × 10–12","orig",["chest"],"load","Main chest builder. Squeeze your chest at the end of each rep.","Set the seat so the handles line up with the middle of your chest. Keep your shoulder blades back against the pad and don't lock your elbows at the end.",["chest","circles"],{q:"machine chest press",
        h:H("Machine Chest Press, 4 sets","4 × 8–10","load","Same machine, heavier weight, one extra set. Last reps should be a real grind with clean form.",{q:"machine chest press"})}),
      X("a-mon-inc","Incline Chest Press","3 × 10–12","new",["chest"],"load","Upper chest. This is what gives pecs their shape at the top.","Bench at a low incline, about 30 degrees. Lower the weight to your upper chest with elbows slightly tucked, not flared straight out.",["chest","crossbody"],{q:"incline dumbbell press",db:true}),
      X("a-mon-sp","Machine Shoulder Press","3 × 8–10","orig",["shoulders"],"load","Stop one rep short of failure on the last set.","Seat height so the handles start at shoulder level. Back flat on the pad, press up without shrugging, and lower under control.",["crossbody","neck"],{q:"machine shoulder press",
        h:H("Standing Dumbbell Overhead Press","4 × 10","load","Stand tall, brace your core and glutes, press the dumbbells overhead without leaning back. Standing makes your whole trunk work.",{q:"standing dumbbell overhead press",db:true})}),
      X("a-mon-lat","Dumbbell Lateral Raise","3 × 12–15","new",["shoulders"],"load","Light weight. Widens the shoulders and makes the waist look smaller.","Stand tall with a slight bend in the elbows. Raise to shoulder height, leading with your elbows, and lower slowly.",["circles","neck"],{db:true}),
      X("a-mon-push","Cable Tricep Pushdown","3 × 10–12","new",["arms"],"load","Triceps, standing tall the whole time.","Rope or bar at the top pulley. Pin your elbows to your sides and push down until your arms are straight, then let it rise slowly.",["triceps","forearm"], {}),
      X("a-mon-fly","Pec Fly Machine","2 × 12–15","new",["chest"],"load","Finisher for the chest. Slow on the way back.","Handles at chest height, slight bend in the elbows. Bring your hands together in front of your chest like hugging a barrel.",["chest","shrug"],{q:"pec deck fly machine",
        h:H("Push-Ups","3 × 12–15","bw","Hands a little wider than shoulders, body straight from head to heels. Lower your chest to just above the floor and press up.")})
    ]},
    Tue: { title: "Back, Biceps", ex: [
      X("a-tue-pd","Lat Pulldown","3 × 10–12","orig",["back"],"load","Pull to your upper chest, elbows down toward your back pockets.","Thighs snug under the pad, grip a little wider than shoulders. Lean back slightly and pull the bar to your upper chest.",["lat","bicep"]),
      X("a-tue-row","Seated Row Machine","3 × 10–12","orig",["back"],"load","Chest on the pad. Squeeze your shoulder blades together.","Sit tall with your chest on the pad. Pull the handles toward your ribs and pause with shoulder blades squeezed.",["lat","crossbody"],{q:"seated row machine"}),
      X("a-tue-pu","Assisted Pull-Up Machine","3 × 8–10","orig",["back","arms"],"assist","Use as much assist as you need. Lower the assist a notch when 10 reps feel easy.","More weight on the stack means more help. Kneel or stand on the pad, pull your chest toward the bar, and lower slowly.",["lat","forearm"],{
        h:H("Negative Pull-Ups","3 × 5","bw","Step or jump to the top of a pull-up, then lower yourself as slowly as you can, 3–5 seconds. Builds toward full pull-ups.",{q:"negative pull ups"})}),
      X("a-tue-bext","Back Extension","3 × 10–12","new",["back","core","glutes"],"bw","Builds lower-back strength. Bodyweight, slow, no swinging.","Hip pad just below your hip bones. Lower down slowly, then rise until your body is in a straight line. Don't arch past straight.",["backarch","twist"],{q:"45 degree back extension",
        h:H("Weighted Back Extension","3 × 12","load","Same movement holding a plate or dumbbell against your chest.",{q:"weighted 45 degree back extension"})}),
      X("a-tue-rdelt","Reverse Pec Deck","3 × 12–15","new",["shoulders","back"],"load","Rear shoulders. Pulls your posture upright.","Face the pad, handles at shoulder height. Open your arms wide with a slight elbow bend and squeeze between your shoulder blades.",["chest","shrug"],{q:"reverse pec deck rear delt"}),
      X("a-tue-curl","Dumbbell Bicep Curl","3 × 10–12","orig",["arms"],"load","No swinging. Lower slowly.","Stand tall, elbows at your sides. Curl up, squeeze, and take about three seconds to lower.",["bicep","forearm"],{db:true})
    ]},
    Wed: { title: "Legs, Glutes", ex: [
      X("a-wed-ht","Smith Machine Hip Thrust","3 × 10–12","new",["glutes"],"load","Top glute builder. Shoulders on a bench, pad on the bar, pause at the top.","Upper back on a bench, bar over your hip crease with a pad. Feet flat, drive through your heels, and tuck your chin. Squeeze hard at the top for a second.",["hipflex","fig4"], {}),
      X("a-wed-dl","Dumbbell Sumo Deadlift","3 × 10","new",["glutes","legs","back"],"load","A deadlift that keeps your chest fairly upright. Glutes, hamstrings, and back together.","Wide stance, toes turned out, one heavy dumbbell held by the top end between your feet. Push your hips back, keep your chest up and back flat, then stand up by squeezing your glutes.",["hamstring","backarch"],{q:"dumbbell sumo deadlift",
        h:H("Heavy Dumbbell Deadlift","4 × 8","load","A dumbbell in each hand at your sides. Hips back, flat back, stand up tall. Go heavy: this is one of the best lifts for bone density.",{q:"dumbbell deadlift",db:true})}),
      X("a-wed-sq","Smith Machine Box Squat","3 × 8–10","orig",["legs","glutes"],"load","Sit back to a bench. Only go as deep as your knees allow.","Bench behind you, feet slightly in front of the bar. Sit back until you lightly touch the bench, then stand up. Knees follow your toes.",["quad","ankle"],{q:"smith machine box squat",
        h:H("Smith Machine Squat, Full Depth","4 × 8","load","No bench. Squat until your thighs are at least parallel, then drive up.",{q:"smith machine squat"}),
        notes:{mat:"Box height is your call. Lower it slowly over weeks as your knees allow."}}),
      X("a-wed-lunge","Dumbbell Reverse Lunge","3 × 8 per leg","new",["glutes","legs"],"load","Stepping back is the most knee-friendly lunge, and it works the glutes hard.","Dumbbell in each hand, stand tall. Take a long step back and lower until your back knee is just above the floor. Lean your chest slightly forward for more glute work, then push through the front heel to stand.",["quad","hipflex"],{q:"dumbbell reverse lunge",db:true,v:LUNGES,
        h:H("Walking Lunges","3 × 10 per leg","load","Dumbbell in each hand, lunge forward and keep moving across the floor, alternating legs. Keep the front knee over your foot.",{q:"dumbbell walking lunge",db:true})}),
      X("a-wed-curl","Leg Curl","3 × 10–12","orig",["legs"],"load","Hamstrings. Slow on the way back.","Pad just above your heels, knees lined up with the machine's pivot. Curl smoothly and take three seconds to return.",["hamstring","fig4"],{q:"seated leg curl machine"}),
      X("a-wed-ext","Leg Extension","2 × 12–15","orig",["legs"],"load","Light and smooth. Stop short of the top if a knee complains.","Knees lined up with the pivot, pad on your lower shins. Lift smoothly and lower slowly. No kicking.",["quad","hipflex"],{q:"leg extension machine"}),
      X("a-wed-abd","Hip Abductor Machine","3 × 15","orig",["glutes"],"load","Lean forward slightly to put more work on the glutes.","Pads on the outside of your knees. Push out, pause, and return slowly. Leaning forward a little shifts it to the glutes.",["fig4","adductor"],{q:"hip abductor machine glutes"})
    ]},
    Thu: { title: "Core, Full Body, Calves", ex: [
      X("a-thu-bug","Dead Bug","3 × 8 per side","new",["core"],"bw","Core work on your back with no crunching and no shoulder load. Press your lower back into the floor.","Lie on a mat or bench, arms up, knees bent over hips. Slowly lower one arm and the opposite leg while keeping your lower back pressed down.",["twist","backarch"],{q:"dead bug exercise",
        h:H("V-Ups","3 × 10–12","bw","Lie flat, arms overhead. Lift your legs and upper body at the same time and reach for your toes, then lower slowly.")}),
      X("a-thu-pallof","Cable Pallof Press","3 × 10 per side","new",["core"],"load","Standing core work. Resist the cable pulling you sideways.","Stand side-on to the cable at chest height. Hold the handle at your chest, press it straight out, hold two seconds, and bring it back.",["twist","lat"],{
        h:H("Bicycle Crunches","3 × 20 total","bw","On your back, hands lightly behind your head. Bring one elbow toward the opposite knee while the other leg extends. Slow and controlled, no yanking your neck.")}),
      X("a-thu-plank","Incline Forearm Plank","3 × 20–30 sec","new",["core","shoulders"],"time","Forearms on a bench. Easier on the shoulders than a floor plank.","Forearms on a bench, body in a straight line from head to heels. Squeeze your glutes and breathe.",["backarch","shrug"],{q:"incline forearm plank bench",
        h:H("Floor Plank","3 × 45–60 sec","time","Forearms on the floor, elbows under shoulders, body straight. Squeeze glutes and brace like you're about to be poked in the stomach.",{q:"forearm plank"})}),
      X("a-thu-goblet","Goblet Box Squat","3 × 10","orig",["legs","glutes"],"load","Hold one dumbbell at your chest and sit to a bench.","Hold one dumbbell upright against your chest. Sit back to a bench, touch lightly, and stand up tall.",["quad","fig4"],{q:"goblet squat to box",
        h:H("Jump Squats","3 × 8","bw","Squat to parallel, then jump straight up. Land softly with bent knees and reset before the next rep. Impact builds bone density.")}),
      X("a-thu-farmer","Farmer Carry","3 × 40 steps","new",["core","full"],"carry","Heavy dumbbell in each hand, walk tall. Trains core, grip, and posture at once.","Pick up the dumbbells with a flat back. Shoulders down, chest up, and walk with short, steady steps.",["forearm","neck"],{q:"farmers carry dumbbells",db:true,
        h:H("Heavy Farmer Carry","3 × 60 steps","carry","The heaviest dumbbells you can hold with good posture for the full walk.",{q:"farmers carry",db:true})}),
      X("a-thu-calf","Standing Calf Raise (Smith)","3 × 12–15","orig",["calves"],"load","Skip it on days a foot is sore.","Balls of your feet on a small plate or step, bar on your upper back. Rise up, pause, lower your heels slowly.",["calf","ankle"],{q:"smith machine calf raise",
        h:H("Jump Rope","3 × 60 sec","time","Small quick hops on the balls of your feet. Good for calves, cardio, and bone density.",{q:"jump rope basics"}),
        notes:{mat:"Skip this while the foot is healing."}})
    ]}
  },
  B: {
    Mon: { title: "Chest, Shoulders, Triceps", ex: [
      X("b-mon-inc","Incline Dumbbell Press","3 × 8–10","new",["chest"],"load","Upper chest again, with dumbbells this week for variety.","Bench at about 30 degrees. Start with dumbbells over your chest, lower to the sides of your upper chest, and press back up.",["chest","circles"],{db:true,
        h:H("Incline Dumbbell Press, 4 sets","4 × 8","load","Heavier dumbbells and an extra set. Pause for a second at the bottom of each rep.",{q:"incline dumbbell press",db:true})}),
      X("b-mon-fly","Pec Fly Machine","3 × 12–15","new",["chest"],"load","Stretch at the open position, squeeze in the middle.","Handles at chest height, slight bend in the elbows. Open until you feel a gentle chest stretch, then squeeze together.",["chest","crossbody"],{q:"pec deck fly machine",
        h:H("Decline Push-Ups","3 × 10–12","bw","Feet up on a bench, hands on the floor. Lower your chest toward the floor and press up. Hits the upper chest and shoulders.")}),
      X("b-mon-sp","Seated Dumbbell Shoulder Press","3 × 8–10","orig",["shoulders"],"load","Back against an upright bench for support.","Bench fully upright. Start with dumbbells at shoulder height, press up and slightly in, and lower under control.",["crossbody","neck"],{db:true,
        h:H("Standing Dumbbell Overhead Press","4 × 10","load","Stand tall, brace your core and glutes, press overhead without leaning back.",{q:"standing dumbbell overhead press",db:true})}),
      X("b-mon-clat","Cable Lateral Raise","3 × 12–15","new",["shoulders"],"load","One arm at a time. Smooth all the way up and down.","Stand side-on to a low pulley and hold the handle in the far hand. Raise out to shoulder height and lower slowly.",["circles","neck"], {}),
      X("b-mon-dip","Assisted Dip Machine","3 × 8–12","new",["arms","chest"],"assist","Triceps and lower chest. Go only halfway down if your shoulders feel any pinch.","Kneel on the pad, hands on the handles, body upright. Lower until your elbows reach about 90 degrees, then press up.",["chest","triceps"],{
        h:H("Bodyweight Dips","3 × max","bw","On parallel bars or the dip handles of the captain's chair. Lower to about 90 degrees at the elbow and press up.",{q:"parallel bar dips"})}),
      X("b-mon-ohext","Overhead Cable Tricep Extension","2 × 12–15","new",["arms"],"load","Face away from the cable, stand upright, press overhead.","Rope on a low or middle pulley, face away, elbows pointing forward by your head. Straighten your arms overhead and return slowly.",["triceps","forearm"],{q:"overhead cable tricep extension rope"})
    ]},
    Tue: { title: "Back, Biceps", ex: [
      X("b-tue-cgpd","Close-Grip Lat Pulldown","3 × 10–12","orig",["back"],"load","Use the V-handle or a narrow grip. Pull to your chest.","V-handle on the pulldown cable. Lean back slightly and pull the handle to your upper chest, elbows close to your body.",["lat","bicep"],{
        h:H("Chin-Ups (assisted if needed)","3 × 6–8","assist","Palms facing you on the assisted machine. Use the least assist that still lets you finish every rep with control.",{q:"chin ups"})}),
      X("b-tue-csrow","Chest-Supported Row","3 × 10–12","new",["back"],"load","Chest stays on the pad, so no bending over.","Chest against the pad, arms long. Row the handles toward your ribs and squeeze your shoulder blades together.",["lat","crossbody"],{q:"chest supported row machine"}),
      X("b-tue-sapd","Straight-Arm Cable Pulldown","3 × 12–15","new",["back"],"load","Arms nearly straight, sweep the bar down to your thighs.","Stand facing the high pulley with a bar or rope. Keep arms nearly straight and sweep down to your thighs, feeling your lats work.",["lat","triceps"]),
      X("b-tue-bext","Back Extension","3 × 10–12","new",["back","core","glutes"],"bw","Add a light plate held at your chest once 15 reps feel easy.","Hip pad just below your hip bones. Lower slowly, rise to a straight line, and don't arch past straight.",["backarch","twist"],{q:"45 degree back extension",
        h:H("Weighted Back Extension","3 × 12","load","Hold a plate or dumbbell against your chest.",{q:"weighted 45 degree back extension"})}),
      X("b-tue-face","Cable Face Pull","3 × 12–15","new",["shoulders","back"],"load","Rope to your forehead, elbows high. Good for shoulder health.","Rope at the top of the cable. Pull toward your forehead with elbows high and hands spreading apart at the end.",["chest","shrug"], {}),
      X("b-tue-hammer","Hammer Curl","3 × 10–12","new",["arms"],"load","Palms facing each other. Builds the arm and forearm.","Stand tall, palms facing your thighs. Curl up without swinging and lower slowly.",["bicep","forearm"],{q:"dumbbell hammer curl",db:true})
    ]},
    Wed: { title: "Legs, Glutes", ex: [
      X("b-wed-ht","Dumbbell Hip Thrust","3 × 10–12","new",["glutes"],"load","Shoulders on a bench, dumbbell on your hips. Pause and squeeze at the top.","Upper back on a bench, one dumbbell across your hips. Drive through your heels and squeeze hard at the top for a second.",["hipflex","fig4"],{
        h:H("Single-Leg Hip Thrust","3 × 10 per leg","bw","Same setup, one foot on the floor, other knee pulled in. Add a dumbbell on the working hip when it gets easy.",{q:"single leg hip thrust"})}),
      X("b-wed-rdl","Dumbbell Romanian Deadlift","3 × 10","new",["legs","glutes","back"],"load","The classic hamstring and glute deadlift. Light weight until the movement feels natural.","Stand tall with a dumbbell in each hand. Soften your knees, push your hips straight back, and slide the weights down your thighs until you feel your hamstrings stretch. Back stays flat. Stand up by squeezing your glutes.",["hamstring","fig4"],{q:"dumbbell romanian deadlift",db:true,
        h:H("Single-Leg Romanian Deadlift","3 × 8 per leg","load","One dumbbell in the opposite hand. Hinge on one leg, other leg reaching back. Great for balance and hip strength.",{q:"single leg romanian deadlift dumbbell",db:true})}),
      X("b-wed-lp","Leg Press (feet high and wide)","3 × 10–12","orig",["legs","glutes"],"load","High, wide feet shift the work to your glutes.","Feet high and a little wider than shoulders on the platform. Lower until your knees are around 90 degrees and push through your heels. Don't lock your knees.",["quad","ankle"],{q:"leg press glute focus feet high",
        h:H("Leg Press, Heavy","4 × 8","load","Normal foot position, heavier weight, full controlled range.",{q:"leg press"}),
        notes:{mat:"Wait until the foot is pain-free on walks and stairs. Use the swap until then."}}),
      X("b-wed-split","Dumbbell Split Squat","3 × 8 per leg","new",["legs","glutes"],"load","A lunge that stays in place, so balance and knees stay under control.","Split stance, back heel up, dumbbell in each hand. Lower straight down until the back knee is just above the floor, then press up through the front heel. Finish all reps, then switch legs.",["quad","hipflex"],{q:"dumbbell split squat",db:true,v:LUNGES,
        h:H("Bulgarian Split Squat","3 × 8 per leg","load","Rear foot on a bench behind you, dumbbell in each hand. Lower on the front leg until the thigh is near parallel, then drive up.",{q:"dumbbell bulgarian split squat",db:true})}),
      X("b-wed-curl","Leg Curl","3 × 10–12","orig",["legs"],"load","Slow on the way back.","Pad just above your heels, knees lined up with the pivot. Curl smoothly, take three seconds to return.",["hamstring","fig4"],{q:"seated leg curl machine"}),
      X("b-wed-add","Hip Adductor Machine","2 × 12–15","orig",["legs"],"load","Inner thighs. Controlled, no bouncing.","Pads on the inside of your knees. Squeeze your legs together, pause, and open slowly.",["adductor","hipflex"],{q:"hip adductor machine"}),
      X("b-wed-abd","Hip Abductor Machine","2 × 15","orig",["glutes"],"load","Lean forward slightly for more glute work.","Pads on the outside of your knees. Push out, pause, and return slowly.",["fig4","adductor"],{q:"hip abductor machine glutes"})
    ]},
    Thu: { title: "Core, Full Body, Calves", ex: [
      X("b-thu-rot","Torso Rotation Machine","3 × 12 per side","new",["core"],"load","Controlled turns. Obliques and the sides of your waist.","Sit tall, knees locked in, and rotate slowly through your midsection. Keep the weight light and the range comfortable.",["twist","lat"],{q:"torso rotation machine",
        h:H("Weighted Russian Twist","3 × 20 total","load","Sit with knees bent, lean back slightly, and hold a dumbbell or plate at your chest. Rotate side to side. Lift your feet to make it harder.",{q:"weighted russian twist"})}),
      X("b-thu-knee","Captain's Chair Knee Raise","3 × 8–12","new",["core"],"bw","Back against the pad, bring your knees up. No crunching.","Forearms on the pads, back flat against the backrest. Raise your knees toward your chest and lower slowly without swinging.",["backarch","hipflex"],{q:"captains chair knee raise",
        h:H("Captain's Chair Straight-Leg Raise","3 × 10–12","bw","Same setup, but keep your legs straight and lift them to hip height or higher. Lower slowly without swinging.",{q:"captains chair straight leg raise"})}),
      X("b-thu-suit","Suitcase Carry","3 × 30 steps per side","new",["core","full"],"carry","One heavy dumbbell in one hand. Walk tall without leaning.","One dumbbell at your side. Stand tall with your shoulders level and walk slowly. Switch hands each set.",["lat","forearm"],{q:"suitcase carry"}),
      X("b-thu-hold","Back Extension Hold","3 × 20–30 sec","new",["back","core"],"time","Hold your body straight at the top of the back extension.","Rise to a straight line on the back extension bench and hold. Squeeze your glutes. Lower slowly when done.",["backarch","twist"],{q:"back extension isometric hold",
        h:H("Sit-Ups","3 × 15","bw","Feet anchored or flat, arms crossed on your chest. Curl all the way up and lower slowly. Hold a plate at your chest to make it harder.",{q:"sit ups"})}),
      X("b-thu-goblet","Goblet Box Squat","3 × 10","orig",["legs","glutes"],"load","Lower the bench over time if your knees allow.","Hold one dumbbell upright at your chest. Sit back to a bench, touch lightly, and stand up tall.",["quad","fig4"],{q:"goblet squat to box",
        h:H("Dumbbell Step-Ups","3 × 10 per leg","load","Knee-height box or bench, dumbbell in each hand. Drive up through the top foot without pushing off the bottom one.",{q:"dumbbell step ups",db:true})}),
      X("b-thu-calf","Standing Calf Raise (Smith)","3 × 12–15","orig",["calves"],"load","Skip it on days a foot is sore.","Balls of your feet on a small plate or step. Rise up, pause, and lower your heels slowly.",["calf","ankle"],{q:"smith machine calf raise",
        h:H("Jump Rope","3 × 60 sec","time","Small quick hops on the balls of your feet.",{q:"jump rope basics"}),
        notes:{mat:"Skip this while the foot is healing."}})
    ]}
  }
};

// Cardio program per person. type is what shows up in the log; plan is the target.
export const CARDIO = {
  mat: {
    options: ["Bike", "Elliptical", "Incline walk", "Other"],
    plan: () => ({ type: "Bike", text: "20–25 minutes on the bike, elliptical, or an incline walk. Leave unchecked on days you bike to work.", hiit: false })
  },
  benny: {
    options: ["Treadmill", "Bike", "Elliptical", "Rower", "Other"],
    plan: (week, day) => ({
      A: {
        Mon: { type: "Treadmill", hiit: false, text: "Steady: 2 miles at a pace where you can still talk (zone 2). This is the resting-heart-rate builder." },
        Tue: { type: "Bike", hiit: true, text: "Intervals: 5 min easy, then 8 rounds of 30 sec hard / 90 sec easy, then 5 min easy." },
        Wed: { type: "Elliptical", hiit: false, text: "Steady: 20–25 minutes, conversational pace." },
        Thu: { type: "Treadmill", hiit: true, text: "Intervals: 5 min easy, then 6 rounds of 1 min fast / 2 min walk, then 5 min easy." }
      },
      B: {
        Mon: { type: "Bike", hiit: false, text: "Steady: 25 minutes, conversational pace (zone 2)." },
        Tue: { type: "Elliptical", hiit: true, text: "Intervals: 5 min easy, then 10 rounds of 20 sec all-out / 40 sec easy, then 5 min easy." },
        Wed: { type: "Treadmill", hiit: false, text: "Steady: 2 miles with 1–2% incline." },
        Thu: { type: "Bike", hiit: true, text: "VO2 max intervals: 5 min easy, then 4 rounds of 4 min hard / 3 min easy, then 5 min easy." }
      }
    })[week][day]
  }
};

export const DAYS = ["Mon", "Tue", "Wed", "Thu"];
export const DAY_NAMES = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday" };

// Every exercise by id, with its week/day.
export const ALL_EX = {};
for (const w of ["A", "B"]) for (const d of DAYS) for (const e of PLAN[w][d].ex) ALL_EX[e.id] = { ...e, week: w, day: d };

// The version of an exercise a person does by default ("std" or "hard").
export function variantDef(ex, variant) {
  if (variant === "hard" && ex.h) return { name: ex.h.n, sr: ex.h.sr, kind: ex.h.kind, db: ex.h.db, q: ex.h.q };
  if (variant === "swap" && ex.swap) return { name: ex.swap.n, sr: ex.swap.sr || ex.sr, kind: ex.swap.kind, db: ex.swap.db, q: ex.swap.q };
  return { name: ex.n, sr: ex.sr, kind: ex.kind, db: ex.db, q: ex.q };
}
export function defaultVariant(ex, user) {
  return PROFILES[user].defaultVariant === "hard" && ex.h ? "hard" : "std";
}

// A definition for any logged exercise, including ones added by hand that aren't in the plan.
export function exDef(id, entry = {}) {
  if (ALL_EX[id]) return ALL_EX[id];
  return { id, n: entry.name || "Exercise", sr: entry.sr || "3 × 10", tag: "new", focus: entry.focus || [], kind: entry.kind || "load", db: !!entry.db,
    why: "Added by you.", setup: "", s: [], swap: null, q: entry.name || "", h: null, v: null, notes: {}, custom: true };
}
