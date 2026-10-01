// Joint load and injury risks for every plan exercise (standard version).
// Harder and swap versions use the matching library exercise when one exists, otherwise these.
import { BUILTIN } from "./library.js";

const R = (joints, ...risks) => ({ joints, risks: risks.map(([area, risk, avoid]) => ({ area, risk, avoid })) });

export const PLAN_SAFETY = {
  // ---- Week A Monday
  "a-mon-cp": R({ shoulders: 1, elbows: 1, wrists: 1 },
    ["shoulders", "Front-of-shoulder strain", "Seat height so handles are at mid-chest, shoulder blades back on the pad, and don't let the handles travel behind your chest."],
    ["elbows", "Elbow strain from locking out hard", "Stop just short of locking your elbows."]),
  "a-mon-inc": R({ shoulders: 2, elbows: 1, wrists: 1 },
    ["shoulders", "Shoulder impingement, worse at steep angles", "Keep the incline around 30° and elbows slightly tucked."]),
  "a-mon-sp": R({ shoulders: 2, elbows: 1, lowerBack: 1 },
    ["shoulders", "Shoulder impingement", "Start with handles at shoulder level, press without shrugging, and stop if you feel a pinch at the top."],
    ["lowerBack", "Low back arching", "Keep your back on the pad and ribs down."]),
  "a-mon-lat": R({ shoulders: 1, neck: 1 },
    ["shoulders", "Impingement from going too high or tipping thumbs down", "Stop at shoulder height, thumbs level or slightly up."],
    ["neck", "Neck strain from shrugging", "Shoulders down, lighter weight, no swinging."]),
  "a-mon-push": R({ elbows: 2, wrists: 1 },
    ["elbows", "Elbow tendon irritation", "Elbows pinned to your sides, smooth reps, don't snap to lockout."],
    ["wrists", "Wrist strain", "Use the rope or a straight bar that keeps your wrists neutral."]),
  "a-mon-fly": R({ shoulders: 2 },
    ["shoulders", "Chest or front-shoulder strain at the open position", "Set the arms so the stretch starts at chest level, keep elbows soft, and don't let the weight yank you open."]),
  // ---- Week A Tuesday
  "a-tue-pd": R({ shoulders: 1, elbows: 1 },
    ["shoulders", "Shoulder strain from pulling behind the neck", "Always pull to the front of your chest, never behind your head."],
    ["elbows", "Elbow tendon irritation (golfer's elbow)", "Don't death-grip; pull with your back, elbows down to your sides."]),
  "a-tue-row": R({ shoulders: 1, lowerBack: 1 },
    ["lowerBack", "Low back strain from rocking", "Chest stays on the pad. If you have to rock, go lighter."]),
  "a-tue-pu": R({ shoulders: 2, elbows: 1 },
    ["shoulders", "Shoulder strain at the bottom stretch", "Don't drop into a dead hang; keep a little tension at the bottom and lower slowly."],
    ["elbows", "Elbow tendon strain", "Smooth reps; use more assist rather than jerking."]),
  "a-tue-bext": R({ lowerBack: 2, hips: 1 },
    ["lowerBack", "Low back strain from overarching at the top", "Rise only to a straight line from head to heels. Never arch past straight."],
    ["hips", "Bruised hips from the pad", "Pad just below the hip bones so you can bend freely."]),
  "a-tue-rdelt": R({ shoulders: 1 },
    ["shoulders", "Shoulder strain from heavy swinging", "Light weight, slight elbow bend, pause at the back."]),
  "a-tue-curl": R({ elbows: 1, wrists: 1 },
    ["elbows", "Inner-elbow tendon irritation", "Lower slowly and don't swing."]),
  // ---- Week A Wednesday
  "a-wed-ht": R({ lowerBack: 1, hips: 1, neck: 1 },
    ["lowerBack", "Low back arching at the top", "Ribs down, chin tucked, finish with your glutes."],
    ["hips", "Bruising from the bar", "Use a thick pad on the bar."]),
  "a-wed-dl": R({ lowerBack: 1, hips: 1, knees: 1 },
    ["lowerBack", "Low back strain", "Chest up, back flat, dumbbell close to your body."]),
  "a-wed-sq": R({ knees: 2, hips: 1, lowerBack: 1 },
    ["knees", "Knee pain from going too deep or knees caving", "Set the bench at a depth that feels fine, knees pushed out over your toes."],
    ["lowerBack", "Low back strain from plopping onto the bench", "Touch the bench lightly; don't relax and bounce off it."]),
  "a-wed-lunge": R({ knees: 1, hips: 1, ankles: 1 },
    ["knees", "Knee pain", "Long step back, front knee over the foot."],
    ["ankles", "Losing balance", "Hold one dumbbell, or a machine, for balance."]),
  "a-wed-curl": R({ knees: 1 },
    ["knees", "Hamstring cramp or knee strain", "Line up your knee with the machine's pivot and don't snap the weight back."]),
  "a-wed-ext": R({ knees: 2 },
    ["knees", "Kneecap pain (the front of the knee takes a lot of load here)", "Light weight, smooth reps, and stop short of full lockout. Skip it if your knees ache."]),
  "a-wed-abd": R({ hips: 1 },
    ["hips", "Hip strain from bouncing", "Controlled reps through a comfortable range."]),
  // ---- Week A Thursday
  "a-thu-bug": R({ lowerBack: 1 },
    ["lowerBack", "Low back arching off the floor", "Only lower your arm and leg as far as your back stays flat."]),
  "a-thu-pallof": R({ lowerBack: 1, shoulders: 1 },
    ["lowerBack", "Twisting under load", "Stand tall, hips square; the point is to resist turning."]),
  "a-thu-plank": R({ shoulders: 1, lowerBack: 1 },
    ["lowerBack", "Low back sag", "Squeeze glutes, tuck your hips slightly, stop when form breaks."],
    ["shoulders", "Shoulder strain", "Elbows under shoulders; the bench takes most of the load."]),
  "a-thu-goblet": R({ knees: 1, hips: 1 },
    ["knees", "Knee pain", "Raise the bench until comfortable."]),
  "a-thu-farmer": R({ shoulders: 1, lowerBack: 1, wrists: 1 },
    ["lowerBack", "Back strain picking up or putting down", "Squat down with a flat back to lift and set the weights down."],
    ["ankles", "Dropping a dumbbell on your foot", "Clear path, controlled set-down."]),
  "a-thu-calf": R({ ankles: 2 },
    ["ankles", "Achilles or plantar fascia irritation", "Slow reps, no bouncing, skip with a foot injury."]),
  // ---- Week B Monday
  "b-mon-inc": R({ shoulders: 2, elbows: 1, wrists: 1 },
    ["shoulders", "Shoulder impingement", "Bench at 30° or lower, elbows slightly tucked."],
    ["shoulders", "Injury getting into position", "Rest dumbbells on your thighs and kick them up as you lie back."]),
  "b-mon-fly": R({ shoulders: 2 },
    ["shoulders", "Chest or shoulder strain at the stretch", "Don't let the arms open past chest level; elbows soft."]),
  "b-mon-sp": R({ shoulders: 2, elbows: 1, lowerBack: 1 },
    ["shoulders", "Shoulder impingement", "Press slightly in front of your head and don't lower below ear level if it pinches."],
    ["lowerBack", "Low back arching", "Back flat on the upright pad."]),
  "b-mon-clat": R({ shoulders: 1 },
    ["shoulders", "Impingement", "Stop at shoulder height, thumb level."]),
  "b-mon-dip": R({ shoulders: 2, elbows: 1, wrists: 1 },
    ["shoulders", "Front-of-shoulder strain from going too deep", "Lower only until elbows reach about 90°. Stop if it pinches."]),
  "b-mon-ohext": R({ elbows: 2, shoulders: 1 },
    ["elbows", "Elbow tendon strain", "Elbows point forward and stay still; lighter weight, slow reps."]),
  // ---- Week B Tuesday
  "b-tue-cgpd": R({ shoulders: 1, elbows: 1 },
    ["elbows", "Elbow tendon irritation", "Pull with your back, not your arms; don't jerk."]),
  "b-tue-csrow": R({ shoulders: 1 },
    ["shoulders", "Shoulder strain at the end of the row", "Pull to your ribs, not your armpits."]),
  "b-tue-sapd": R({ shoulders: 1, lowerBack: 1 },
    ["lowerBack", "Low back strain from leaning", "Slight hinge, abs braced, arms do the sweeping."]),
  "b-tue-bext": R({ lowerBack: 2, hips: 1 },
    ["lowerBack", "Low back strain from overarching", "Straight line at the top, never past it. Add weight slowly."]),
  "b-tue-face": R({ shoulders: 1, neck: 1 },
    ["neck", "Neck strain", "Keep your head still and shoulders down."]),
  "b-tue-hammer": R({ elbows: 1 },
    ["elbows", "Elbow tendon irritation", "Controlled reps, no swinging."]),
  // ---- Week B Wednesday
  "b-wed-ht": R({ lowerBack: 1, neck: 1 },
    ["lowerBack", "Low back arching at the top", "Ribs down, glutes finish the lift."],
    ["hips", "Bruising from the dumbbell", "Fold a towel under it."]),
  "b-wed-rdl": R({ lowerBack: 2, hips: 1 },
    ["lowerBack", "Low back strain from rounding", "Flat back, stop at the hamstring stretch."],
    ["hips", "Hamstring strain", "Slow lowering, no bouncing."]),
  "b-wed-lp": R({ knees: 2, lowerBack: 1, hips: 1 },
    ["lowerBack", "Low back rounding at the bottom", "Don't lower so far that your hips curl up off the seat."],
    ["knees", "Knee strain from locking out", "Stop just short of straight; never lock under heavy weight."]),
  "b-wed-split": R({ knees: 2, hips: 1, ankles: 1 },
    ["knees", "Front knee pain", "Shin fairly upright, knee over the foot, shorter range if needed."]),
  "b-wed-curl": R({ knees: 1 },
    ["knees", "Knee strain", "Knee lined up with the pivot, controlled return."]),
  "b-wed-add": R({ hips: 1 },
    ["hips", "Groin strain", "Start with a comfortable opening; don't let the pads yank your legs wide."]),
  "b-wed-abd": R({ hips: 1 },
    ["hips", "Hip strain from bouncing", "Controlled reps."]),
  // ---- Week B Thursday
  "b-thu-rot": R({ lowerBack: 2 },
    ["lowerBack", "Low back strain from twisting under load", "Light weight and a range that feels easy. Skip it during back aches."]),
  "b-thu-knee": R({ shoulders: 1, lowerBack: 1 },
    ["lowerBack", "Low back strain from swinging", "Back pressed into the pad, slow lift and lower."],
    ["shoulders", "Shoulder strain from hanging", "Press down into the forearm pads, shoulders away from your ears."]),
  "b-thu-suit": R({ lowerBack: 1, shoulders: 1 },
    ["lowerBack", "Low back strain from leaning", "Shoulders level. Go lighter if you lean."]),
  "b-thu-hold": R({ lowerBack: 1 },
    ["lowerBack", "Low back strain", "Hold a straight line, not an arch."]),
  "b-thu-goblet": R({ knees: 1, hips: 1 },
    ["knees", "Knee pain", "Raise the bench until comfortable."]),
  "b-thu-calf": R({ ankles: 2 },
    ["ankles", "Achilles or plantar fascia irritation", "Slow reps, no bouncing, skip with a foot injury."])
};

// Harder and swap versions: use the library entry with the same (or very close) name.
const norm = s => s.toLowerCase().replace(/^dumbbell |^weighted |\(.*\)|,.*$/g, "").replace(/[^a-z]+/g, " ").trim();
const LIB_BY_NAME = new Map(BUILTIN.map(b => [norm(b.name), b]));
const EXTRA = {
  "push ups": R({ shoulders: 1, wrists: 2, lowerBack: 1 },
    ["wrists", "Wrist strain", "Hands under shoulders, or hold dumbbell handles to keep wrists straight."],
    ["lowerBack", "Low back sag", "Squeeze glutes and abs; do them from your knees or against a bench if your back aches."]),
  "decline push ups": R({ shoulders: 2, wrists: 2, lowerBack: 1 },
    ["shoulders", "Shoulder strain", "Lower slowly with elbows at about 45°."]),
  "v ups": R({ lowerBack: 2, neck: 1, hips: 1 },
    ["lowerBack", "Low back strain", "Bend your knees a little and only lift as high as you can control."]),
  "bicycle crunches": R({ neck: 1, lowerBack: 1 },
    ["neck", "Neck strain from pulling your head", "Fingertips lightly behind your head; turn your ribs, not your elbows."]),
  "sit ups": R({ neck: 1, lowerBack: 1 },
    ["neck", "Neck strain", "Arms crossed on your chest; don't pull your head."]),
  "jump squats": R({ knees: 2, ankles: 2, hips: 1 },
    ["knees", "Knee pain from hard landings", "Land quietly with bent knees."],
    ["ankles", "Foot or ankle injury", "Skip with any foot, ankle or knee injury."]),
  "jump rope": R({ ankles: 2, knees: 1 },
    ["ankles", "Achilles or shin irritation", "Small hops on the balls of your feet; skip with foot injuries."]),
  "negative pull ups": R({ shoulders: 2, elbows: 2 },
    ["elbows", "Elbow tendon strain", "Lower slowly and stop the set when you can't control the descent."]),
  "bodyweight dips": R({ shoulders: 2, elbows: 1, wrists: 1 },
    ["shoulders", "Front-of-shoulder strain", "Only lower to about 90° at the elbows."]),
  "floor plank": R({ shoulders: 1, lowerBack: 1 },
    ["lowerBack", "Low back sag", "Glutes squeezed, stop when your hips drop."]),
  "wall sit": R({ knees: 2 },
    ["knees", "Kneecap pain", "Slide down only as far as feels comfortable."]),
  "dead bug hold": R({ lowerBack: 1 },
    ["lowerBack", "Low back arching", "Keep it pressed into the floor."])
};

const ALIAS = {
  "walking lunges": "db-walking-lunge", "heavy dumbbell deadlift": "db-deadlift", "dumbbell step ups": "db-step-up", "step ups": "db-step-up",
  "static split squat": "db-split-squat", "overhead dumbbell tricep extension": "db-oh-tri-ext", "heavy farmer carry": "db-farmer-carry",
  "goblet squat to a bench": "db-goblet-box-squat", "goblet reverse lunge": "db-reverse-lunge", "back extension": null
};
const BY_ID = new Map(BUILTIN.map(b => [b.id, b]));
export function safetyFor(ex, variant) {
  const pick = n => { const k = norm(n); return (ALIAS[k] && BY_ID.get(ALIAS[k])) || LIB_BY_NAME.get(k) || EXTRA[k]; };
  if (variant === "hard" && ex.h) { const m = pick(ex.h.n); if (m) return m; }
  if (variant === "swap" && ex.swap) { const m = pick(ex.swap.n); if (m) return m; }
  return PLAN_SAFETY[ex.id] || null;
}
