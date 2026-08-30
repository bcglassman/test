import type { PlanIntensity } from "@/lib/types";

/**
 * The planner's own intensity colours, kept close to the spreadsheet this
 * replaced so a week still reads at a glance: cool for easy, warm for
 * hard. Tinted rather than the spreadsheet's saturated fills, which would
 * fight the rest of the UI and bury the text.
 */
export const INTENSITY_STYLE: Record<
  PlanIntensity,
  { cell: string; dot: string }
> = {
  low: { cell: "bg-[#eaf1f8] border-[#cfe0ef]", dot: "bg-[#5b8db8]" },
  lowModerate: { cell: "bg-[#fdf3dd] border-[#efdfb4]", dot: "bg-[#c9a13c]" },
  moderate: { cell: "bg-[#fbe6d4] border-[#f0cfae]", dot: "bg-[#d9843c]" },
  moderateHigh: { cell: "bg-[#f8d9c4] border-[#e9b995]", dot: "bg-[#c2572a]" },
  rest: { cell: "bg-[#f1f0ec] border-[#e0ded7]", dot: "bg-[#9a978d]" },
};
