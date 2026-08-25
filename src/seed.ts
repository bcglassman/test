/**
 * One-time content seed for a fresh database. Run with `npm run seed`.
 * Safe to re-run — it skips everything if any exercise already exists.
 */
import { getPayload } from "payload";
import config from "./payload.config";
import { solidColorPng } from "./seed-assets";

const ratingDims = [
  { key: "form", label: "Form", max: 10 },
  { key: "control", label: "Control", max: 10 },
  { key: "symmetry", label: "Symmetry", max: 10 },
  { key: "effort", label: "Effort", max: 10 },
];

/** Builds one ratingSets entry per column of per-set scores, e.g. { form: [5, 6, 7] } -> 3 sets. */
function ratingSets(perDimensionScores: Record<string, number[]>) {
  const keys = Object.keys(perDimensionScores);
  const count = Math.max(...keys.map((k) => perDimensionScores[k].length));
  return Array.from({ length: count }, (_, i) => ({
    setNumber: i + 1,
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
      sets: 3,
      reps: 6,
      restLabel: "~60 sec",
      notes:
        "Better control today. Left knee begins moving outward near fatigue.",
      ratingSets: ratingSets({
        form: [5, 6, 7],
        control: [7, 8, 9],
        symmetry: [5, 6, 7],
        effort: [6, 7, 8],
      }),
      media: [
        { setNumber: 1, type: "video", file: sageImg.id, label: "Set 1", notes: "Good alignment early", duration: "0:12", order: 1 },
        { setNumber: 2, type: "video", file: tanImg.id, label: "Set 2", notes: "More controlled descent", duration: "0:11", order: 2 },
        { setNumber: 3, type: "image", file: slateImg.id, label: "Annotated frame", notes: "Left knee flaring", order: 3 },
      ],
    },
  });

  await payload.create({
    collection: "sessions",
    data: {
      exercise: cavaletti.id,
      date: "2026-08-23T18:20:00.000Z",
      sets: 3,
      passes: 5,
      restLabel: "~45 sec",
      notes: "Steady, deliberate steps. Good hip engagement on the left.",
      ratingSets: ratingSets({
        form: [7, 8, 9],
        control: [7, 8, 9],
        symmetry: [8, 9, 10],
        effort: [6, 7, 8],
      }),
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
      notes: "Warm-up to working pace and back down without soreness after.",
      ratingSets: ratingSets({
        form: [7],
        control: [7],
        symmetry: [7],
        effort: [8],
      }),
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
      sets: 3,
      reps: 5,
      restLabel: "~60 sec",
      notes: "First session back after rest. Cautious but willing.",
      ratingSets: ratingSets({
        form: [4, 5, 6],
        control: [5, 6, 7],
        symmetry: [4, 5, 6],
        effort: [5, 6, 7],
      }),
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
