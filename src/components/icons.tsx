import type { SVGProps } from "react";
import type { ExerciseCategory } from "@/lib/types";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

export function SparkleIcon(props: IconProps) {
  return (
    <svg {...base} fill="currentColor" stroke="none" {...props}>
      <path d="M11 2.5c.4 2.4 1 3.9 2 4.9s2.5 1.6 4.9 2c-2.4.4-3.9 1-4.9 2s-1.6 2.5-2 4.9c-.4-2.4-1-3.9-2-4.9s-2.5-1.6-4.9-2c2.4-.4 3.9-1 4.9-2s1.6-2.5 2-4.9z" />
      <path d="M18.5 14.5c.24 1.28.56 2.08 1.08 2.6.52.52 1.32.84 2.6 1.08-1.28.24-2.08.56-2.6 1.08-.52.52-.84 1.32-1.08 2.6-.24-1.28-.56-2.08-1.08-2.6-.52-.52-1.32-.84-2.6-1.08 1.28-.24 2.08-.56 2.6-1.08.52-.52.84-1.32 1.08-2.6z" />
    </svg>
  );
}

export function PawIcon(props: IconProps) {
  return (
    <svg {...base} fill="currentColor" stroke="none" {...props}>
      <circle cx="6.5" cy="9.5" r="2" />
      <circle cx="11.5" cy="6.5" r="2" />
      <circle cx="16.5" cy="7.5" r="2" />
      <circle cx="19.5" cy="12" r="1.8" />
      <path d="M12 12.5c2.6 0 5 1.7 5 4.3 0 1.8-1.5 2.7-3.2 2.5-1.1-.1-1.7-.6-2.3-.6s-1.2.5-2.3.6c-1.7.2-3.2-.7-3.2-2.5 0-2.6 2.4-4.3 5-4.3Z" />
    </svg>
  );
}

export function StrengthIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 9v6M2 10v4M20 9v6M22 10v4M6 9h2v6H6zM16 9h2v6h-2zM8 12h8" />
    </svg>
  );
}

export function CoordinationIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2 17h20M6 17v-4M18 17v-4M12 17v-4" />
      <circle cx="12" cy="6" r="1.6" />
      <path d="M9 13l3-2 3 2" />
    </svg>
  );
}

export function CardioIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="14" width="18" height="6" rx="1.5" />
      <path d="M6 14V9a2 2 0 0 1 2-2h1M15 7h1a2 2 0 0 1 2 2v5M9 20v-2M15 20v-2" />
      <path d="M2 11h5l1.5 2 2-4 1.5 2H21" />
    </svg>
  );
}

export function MobilityIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="4.5" r="1.6" />
      <path d="M12 8v5l3 6M12 13l-3 6M9 10l-3 2M15 10l3 2M12 8l-2 3h4l-2-3" />
    </svg>
  );
}

export function SkillIcon(props: IconProps) {
  return (
    <svg {...base} fill="currentColor" stroke="none" {...props}>
      <path d="M12 2.5l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.4l-5.4 3 1-6.1-4.4-4.3 6.1-.9L12 2.5z" />
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg {...base} fill="currentColor" stroke="none" {...props}>
      <path d="M7 5.5v13l11-6.5-11-6.5z" />
    </svg>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <svg {...base} fill="currentColor" stroke="none" {...props}>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

export function MaximizeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
    </svg>
  );
}

export function MinimizeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M21 16l-5.5-5.5a1.5 1.5 0 0 0-2.1 0L4 19" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13" />
    </svg>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20l.9-3.6L16.4 5a1.4 1.4 0 0 1 2 0l1.6 1.6a1.4 1.4 0 0 1 0 2L8.5 19.1 4 20z" />
    </svg>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 16V6M8 10l4-4 4 4" />
      <path d="M4 17v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />
    </svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8v.01" />
    </svg>
  );
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14M18 13l-6 6-6-6" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function CategoryIcon({
  category,
  ...props
}: { category: ExerciseCategory } & IconProps) {
  switch (category) {
    case "Strength":
      return <StrengthIcon {...props} />;
    case "Coordination":
      return <CoordinationIcon {...props} />;
    case "Cardio":
      return <CardioIcon {...props} />;
    case "Mobility":
      return <MobilityIcon {...props} />;
    case "Skill":
      return <SkillIcon {...props} />;
    default:
      return <PawIcon {...props} />;
  }
}
