import type { RatingDimension } from "./types";

/**
 * Standard rating dimensions with a fixed, consistent 1-5 rubric. Reusing
 * these across exercises (rather than letting the AI wordsmith "Form" fresh
 * each time) keeps a score comparable from one exercise to the next.
 */
export const RATING_LIBRARY: Omit<RatingDimension, "score">[] = [
  {
    key: "form",
    label: "Form",
    max: 5,
    scale: [
      "Significant Form Breakdown",
      "Noticeable Form Deterioration",
      "Minor Form Changes",
      "Maintains Good Form",
      "Maintains Excellent Form Throughout",
    ],
  },
  {
    key: "control",
    label: "Control",
    max: 5,
    scale: [
      "Little to No Control",
      "Frequent Loss of Control",
      "Occasional Loss of Control",
      "Mostly Controlled",
      "Fully Controlled Throughout",
    ],
  },
  {
    key: "symmetry",
    label: "Symmetry",
    max: 5,
    scale: [
      "Highly Asymmetrical",
      "Noticeably Asymmetrical",
      "Slightly Asymmetrical",
      "Mostly Symmetrical",
      "Fully Symmetrical",
    ],
  },
  {
    key: "effort",
    label: "Effort",
    max: 5,
    scale: [
      "Minimal Effort / Disengaged",
      "Low Effort",
      "Moderate Effort",
      "Strong Effort",
      "Maximum Effort Throughout",
    ],
  },
  {
    key: "balance",
    label: "Balance",
    max: 5,
    scale: [
      "Unable to Balance",
      "Frequent Loss of Balance",
      "Occasional Loss of Balance",
      "Good Balance",
      "Excellent Balance Throughout",
    ],
  },
  {
    key: "confidence",
    label: "Confidence",
    max: 5,
    scale: [
      "Fearful / Avoidant",
      "Hesitant",
      "Cautious but Willing",
      "Confident",
      "Fully Confident and Eager",
    ],
  },
  {
    key: "endurance",
    label: "Endurance",
    max: 5,
    scale: [
      "Fatigues Immediately",
      "Fatigues Early",
      "Moderate Endurance",
      "Good Endurance",
      "Excellent Endurance Throughout",
    ],
  },
];
