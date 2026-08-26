import type { Dog } from "@/lib/types";

const SIZES = {
  sm: "h-8 w-8 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-20 w-20 text-xl",
} as const;

/** The dog's photo, or its initial on a tinted circle when there isn't one. */
export function DogAvatar({
  dog,
  size = "md",
  className = "",
}: {
  dog: Dog;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const base = `${SIZES[size]} shrink-0 rounded-full object-cover ${className}`;
  if (dog.photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- media is served from the CMS at arbitrary paths
    return <img src={dog.photoUrl} alt="" className={base} />;
  }
  return (
    <span
      aria-hidden="true"
      className={`${SIZES[size]} shrink-0 flex items-center justify-center rounded-full bg-[var(--color-sage-tint)] font-semibold uppercase text-[var(--color-sage-dark)] ${className}`}
    >
      {dog.name.trim().charAt(0) || "?"}
    </span>
  );
}
