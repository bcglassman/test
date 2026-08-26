/**
 * One-time content seed for a fresh database. Run with `npm run seed`.
 * Safe to re-run — it skips everything if any exercise already exists.
 */
import { getPayload } from "payload";
import config from "./payload.config";
import { solidColorPng } from "./seed-assets";

// 1-5 with wording for each level, so the session form can say what a score
// actually means rather than just showing a number.
const ratingDims = [
  {
    key: "form",
    label: "Form",
    max: 5,
    scale: [
      "Significant form breakdown",
      "Noticeable form deterioration",
      "Minor form changes",
      "Maintains good form",
      "Maintains excellent form throughout",
    ],
  },
  {
    key: "control",
    label: "Control",
    max: 5,
    scale: [
      "Little to no control",
      "Frequent loss of control",
      "Occasional loss of control",
      "Mostly controlled",
      "Fully controlled throughout",
    ],
  },
  {
    key: "symmetry",
    label: "Symmetry",
    max: 5,
    scale: [
      "Heavily favouring one side",
      "Clear asymmetry under load",
      "Slight asymmetry",
      "Near-even loading",
      "Even loading throughout",
    ],
  },
  {
    key: "intensity",
    label: "Intensity",
    max: 5,
    scale: [
      "Barely raised effort, no panting",
      "Light workload, brief panting",
      "Moderate workload, steady panting",
      "Meaningful incline/cardio workload with substantial panting",
      "Maximal sustained effort, heavy panting throughout",
    ],
  },
];

/**
 * Builds the sets array from per-dimension score columns, e.g.
  * { form: [5, 6, 7] } -> 3 sets. `work` sets each set's reps (or passes).
 */
function buildSets(
  perDimensionScores: Record<string, number[]>,
  work: {
    reps?: number[];
    passes?: number[];
    notes?: string[];
    watchItems?: string[][];
  } = {},
) {
  const keys = Object.keys(perDimensionScores);
  const count = Math.max(...keys.map((k) => perDimensionScores[k].length));
  return Array.from({ length: count }, (_, i) => ({
    setNumber: i + 1,
    reps: work.reps?.[i],
    passes: work.passes?.[i],
    notes: work.notes?.[i],
    watchItems: work.watchItems?.[i],
    ratings: keys.map((key) => ({ key, score: perDimensionScores[key][i] })),
  }));
}

async function main() {
  const payload = await getPayload({ config });

  const existingUsers = await payload.find({ collection: "users", limit: 1 });
  if (existingUsers.docs.length === 0) {
    const email = process.env.SEED_ADMIN_EMAIL || "admin@cookietraining.test";
    const password = process.env.SEED_ADMIN_PASSWORD || "cookie-admin-pass";
    await payload.create({ collection: "users", data: { email, password } });
    payload.logger.info(
      `Created admin user ${email} / ${password} — log in at /admin/login and change the password.`,
    );
  }

  const existingExercises = await payload.find({
    collection: "exercises",
    limit: 1,
  });
  if (existingExercises.docs.length > 0) {
    payload.logger.info("Exercises already exist — skipping content seed.");
    process.exit(0);
  }

  const sitToStand = await payload.create({
    collection: "exercises",
    data: {
      name: "Sit to Stand",
      category: "Strength",
      focus: "Hind Limb",
      description:
        "Dog transitions from seated to standing while maintaining symmetrical hind-limb positioning.",
      defaultRatings: ratingDims,
    },
  });

  const cavaletti = await payload.create({
    collection: "exercises",
    data: {
      name: "Cavaletti — Slow Walk",
      category: "Coordination",
      focus: "Hind Limb",
      description: "Deliberate stepping over evenly spaced rails.",
      defaultRatings: ratingDims,
    },
  });

  const treadmill = await payload.create({
    collection: "exercises",
    data: {
      name: "Treadmill Walk",
      category: "Cardio",
      focus: "General",
      description: "Steady-state endurance walk.",
      defaultRatings: ratingDims,
    },
  });

  async function uploadPlaceholder(
    name: string,
    color: [number, number, number],
  ) {
    const buffer = solidColorPng(640, 480, color);
    return payload.create({
      collection: "media",
      data: { alt: name },
      file: {
        data: buffer,
        mimetype: "image/png",
        name: `${name}.png`,
        size: buffer.length,
      },
    });
  }

  const sageImg = await uploadPlaceholder("sit-to-stand-set-1", [180, 191, 172]);
  const tanImg = await uploadPlaceholder("sit-to-stand-set-2", [201, 180, 148]);
  const slateImg = await uploadPlaceholder("sit-to-stand-annotated", [188, 196, 201]);
  const cav1 = await uploadPlaceholder("cavaletti-set-1", [223, 227, 216]);
  const cav2 = await uploadPlaceholder("cavaletti-set-2", [180, 191, 172]);
  const cav3 = await uploadPlaceholder("cavaletti-set-3", [201, 180, 148]);
  const tmWarm = await uploadPlaceholder("treadmill-warmup", [180, 191, 172]);
  const tmWork = await uploadPlaceholder("treadmill-working", [201, 180, 148]);
  const tmCool = await uploadPlaceholder("treadmill-cooldown", [188, 196, 201]);

  await payload.create({
    collection: "sessions",
    data: {
      exercise: sitToStand.id,
      date: "2026-08-24T10:35:00.000Z",
      restLabel: "~60 sec",
      environment: "Air-conditioned gym",
      notes:
        "Better control today. Left knee begins moving outward near fatigue.",
      sets: buildSets(
        {
          form: [2, 3, 4],
          control: [4, 4, 4],
          symmetry: [2, 3, 4],
          intensity: [3, 4, 4],
        },
        {
          reps: [6, 6, 6],
          watchItems: [
            ["Hesitation before rising"],
            [],
            ["Left knee flaring", "Weight shifting right"],
          ],
          notes: [
            "Slow to commit on the first two reps.",
            "Much cleaner once warmed up.",
            "Left knee drifting outward by the last rep.",
          ],
        },
      ),
      media: [
        { setNumber: 1, type: "video", file: sageImg.id, label: "Set 1", notes: "Good alignment early", duration: "0:12", activeMovementSeconds: 12, order: 1 },
        { setNumber: 2, type: "video", file: tanImg.id, label: "Set 2", notes: "More controlled descent", duration: "0:11", activeMovementSeconds: 11, order: 2 },
        { setNumber: 3, type: "image", file: slateImg.id, label: "Annotated frame", notes: "Left knee flaring", order: 3 },
      ],
    },
  });

  await payload.create({
    collection: "sessions",
    data: {
      exercise: cavaletti.id,
      date: "2026-08-23T18:20:00.000Z",
      restLabel: "~45 sec",
      environment: "Outside — cool, overcast",
      notes: "Steady, deliberate steps. Good hip engagement on the left.",
      sets: buildSets(
        {
          form: [4, 4, 4],
          control: [4, 4, 4],
          symmetry: [4, 4, 5],
          intensity: [3, 4, 4],
        },
        {
          passes: [5, 5, 5],
          notes: [
            "Smooth entry, no rail contact.",
            "Rhythm improving through the middle.",
            "Best set — consistent foot placement throughout.",
          ],
        },
      ),
      media: [
        { setNumber: 1, type: "video", file: cav1.id, label: "Set 1", notes: "Smooth entry", duration: "0:13", order: 1 },
        { setNumber: 2, type: "video", file: cav2.id, label: "Set 2", notes: "Improved rhythm", duration: "0:12", order: 2 },
        { setNumber: 3, type: "video", file: cav3.id, label: "Set 3", notes: "Consistent foot placement", duration: "0:12", order: 3 },
      ],
    },
  });

  await payload.create({
    collection: "sessions",
    data: {
      exercise: treadmill.id,
      date: "2026-08-22T09:15:00.000Z",
      restLabel: "~10 min",
      environment: "Indoor treadmill room",
      notes: "Warm-up to working pace and back down without soreness after.",
      sets: buildSets(
        { form: [4], control: [4], symmetry: [4], intensity: [4] },
        { notes: ["Continuous walk — warm-up, working pace, cool down."] },
      ),
      media: [
        { setNumber: 1, type: "video", file: tmWarm.id, label: "Warm up", duration: "0:10", order: 1 },
        { setNumber: 1, type: "video", file: tmWork.id, label: "Working set", duration: "0:15", order: 2 },
        { setNumber: 1, type: "video", file: tmCool.id, label: "Cool down", duration: "0:10", order: 3 },
      ],
    },
  });

  await payload.create({
    collection: "sessions",
    data: {
      exercise: sitToStand.id,
      date: "2026-08-18T15:40:00.000Z",
      restLabel: "~60 sec",
      environment: "Air-conditioned gym",
      notes: "First session back after rest. Cautious but willing.",
      sets: buildSets(
        {
          form: [2, 2, 3],
          control: [2, 3, 4],
          symmetry: [2, 2, 3],
          intensity: [2, 3, 4],
        },
        { reps: [5, 5, 5] },
      ),
      media: [],
    },
  });

  payload.logger.info("Seed complete: 3 exercises, 4 sessions, 9 media assets.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
