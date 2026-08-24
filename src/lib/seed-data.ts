import type { Exercise, TrainingSession } from "./types";

// Placeholder "seed" content, standing in for what a CMS would return.
// Media URLs are empty because there are no real uploaded assets yet —
// the UI renders a styled placeholder for any media item without a url.

const defaultRatings = [
  { key: "form", label: "Form", max: 10 },
  { key: "control", label: "Control", max: 10 },
  { key: "symmetry", label: "Symmetry", max: 10 },
  { key: "effort", label: "Effort", max: 10 },
];

export const seedExercises: Exercise[] = [
  {
    id: "ex-sit-to-stand",
    name: "Sit to Stand",
    category: "Strength",
    focus: "Hind Limb",
    description:
      "Dog transitions from seated to standing while maintaining symmetrical hind-limb positioning.",
    defaultRatings,
  },
  {
    id: "ex-cavaletti",
    name: "Cavaletti — Slow Walk",
    category: "Coordination",
    focus: "Hind Limb",
    description: "Deliberate stepping over evenly spaced rails.",
    defaultRatings,
  },
  {
    id: "ex-treadmill",
    name: "Treadmill Walk",
    category: "Cardio",
    focus: "General",
    description: "Steady-state endurance walk.",
    defaultRatings,
  },
];

export const seedSessions: TrainingSession[] = [
  {
    id: "sess-1",
    exerciseId: "ex-sit-to-stand",
    date: "2026-08-24T10:35:00",
    sets: 3,
    reps: 6,
    restLabel: "~60 sec",
    notes:
      "Better control today. Left knee begins moving outward near fatigue.",
    ratings: [
      { key: "form", label: "Form", score: 6, max: 10 },
      { key: "control", label: "Control", score: 8, max: 10 },
      { key: "symmetry", label: "Symmetry", score: 6, max: 10 },
      { key: "effort", label: "Effort", score: 7, max: 10 },
    ],
    media: [
      {
        id: "m-1",
        type: "video",
        url: "",
        label: "Set 1",
        notes: "Good alignment early",
        duration: "0:12",
        order: 1,
      },
      {
        id: "m-2",
        type: "video",
        url: "",
        label: "Set 2",
        notes: "More controlled descent",
        duration: "0:11",
        order: 2,
      },
      {
        id: "m-3",
        type: "image",
        url: "",
        label: "Annotated frame",
        notes: "Left knee flaring",
        order: 3,
      },
    ],
  },
  {
    id: "sess-2",
    exerciseId: "ex-cavaletti",
    date: "2026-08-23T18:20:00",
    sets: 3,
    passes: 5,
    restLabel: "~45 sec",
    notes: "Steady, deliberate steps. Good hip engagement on the left.",
    ratings: [
      { key: "form", label: "Form", score: 8, max: 10 },
      { key: "control", label: "Control", score: 8, max: 10 },
      { key: "symmetry", label: "Symmetry", score: 9, max: 10 },
      { key: "effort", label: "Effort", score: 7, max: 10 },
    ],
    media: [
      {
        id: "m-4",
        type: "video",
        url: "",
        label: "Set 1",
        notes: "Smooth entry",
        duration: "0:13",
        order: 1,
      },
      {
        id: "m-5",
        type: "video",
        url: "",
        label: "Set 2",
        notes: "Improved rhythm",
        duration: "0:12",
        order: 2,
      },
      {
        id: "m-6",
        type: "video",
        url: "",
        label: "Set 3",
        notes: "Consistent foot placement",
        duration: "0:12",
        order: 3,
      },
    ],
  },
  {
    id: "sess-3",
    exerciseId: "ex-treadmill",
    date: "2026-08-22T09:15:00",
    restLabel: "~10 min",
    notes: "Warm-up to working pace and back down without soreness after.",
    ratings: [
      { key: "form", label: "Form", score: 7, max: 10 },
      { key: "control", label: "Control", score: 7, max: 10 },
      { key: "symmetry", label: "Symmetry", score: 7, max: 10 },
      { key: "effort", label: "Effort", score: 8, max: 10 },
    ],
    media: [
      {
        id: "m-7",
        type: "video",
        url: "",
        label: "Warm up",
        duration: "0:10",
        order: 1,
      },
      {
        id: "m-8",
        type: "video",
        url: "",
        label: "Working set",
        duration: "0:15",
        order: 2,
      },
      {
        id: "m-9",
        type: "video",
        url: "",
        label: "Cool down",
        duration: "0:10",
        order: 3,
      },
    ],
  },
  {
    id: "sess-4",
    exerciseId: "ex-sit-to-stand",
    date: "2026-08-18T15:40:00",
    sets: 3,
    reps: 5,
    restLabel: "~60 sec",
    notes: "First session back after rest. Cautious but willing.",
    ratings: [
      { key: "form", label: "Form", score: 5, max: 10 },
      { key: "control", label: "Control", score: 6, max: 10 },
      { key: "symmetry", label: "Symmetry", score: 5, max: 10 },
      { key: "effort", label: "Effort", score: 6, max: 10 },
    ],
    media: [
      {
        id: "m-10",
        type: "video",
        url: "",
        label: "Set 1",
        notes: "Slow to rise",
        duration: "0:14",
        order: 1,
      },
    ],
  },
];
