/**
 * One-time migration for the per-set ratings schema change.
 *
 * Sessions used to store one flat `ratings: [{ key, label, score, max }]`
 * array. That's now `ratingSets: [{ setNumber, ratings: [{ key, score }] }]`
 * (one entry per set performed) — see README's "Data model" section. The
 * schema push that happens automatically on deploy doesn't carry old data
 * into the new shape, so this converts a pre-deploy backup of the old data
 * into a single "set 1" entry per session, preserving every existing
 * session's original scores.
 *
 * Usage:
 *   1. BEFORE deploying this change, back up the current (old-shape) data:
 *        curl -s "http://<your-site>/api/sessions?limit=200&depth=0" -o /tmp/sessions-backup.json
 *   2. Deploy as normal (this applies the new schema).
 *   3. Run this script against that backup:
 *        npx tsx --env-file=.env.local src/migrate-ratings.ts /tmp/sessions-backup.json
 */
import { readFileSync } from "node:fs";
import { getPayload } from "payload";
import config from "./payload.config";

interface OldRating {
  key: string;
  score: number;
}

interface OldMediaRow {
  type: "video" | "image";
  file: number;
  label?: string | null;
  notes?: string | null;
  duration?: string | null;
  order?: number | null;
}

interface OldRatingSet {
  setNumber: number;
  ratings?: OldRating[];
}

interface OldSessionDoc {
  id: number;
  /** Oldest shape: one flat ratings array on the session. */
  ratings?: OldRating[];
  /** Intermediate shape: per-set ratings, before sets held reps/notes too. */
  ratingSets?: OldRatingSet[];
  /** Session-level reps/passes, before they moved onto each set. */
  reps?: number | null;
  passes?: number | null;
  media?: OldMediaRow[];
}

/**
 * Media used to float free of any set. Recover the set from a "Set N" label
 * where one exists, otherwise put it on set 1 so nothing is orphaned.
 */
function setNumberFor(row: OldMediaRow): number {
  const match = /set\s*(\d+)/i.exec(row.label ?? "");
  return match ? Number(match[1]) : 1;
}

async function main() {
  const backupPath = process.argv[2];
  if (!backupPath) {
    console.error("Usage: tsx src/migrate-ratings.ts <path-to-backup.json>");
    process.exit(1);
  }

  const backup = JSON.parse(readFileSync(backupPath, "utf-8")) as {
    docs: OldSessionDoc[];
  };

  const payload = await getPayload({ config });

  let migrated = 0;
  let skipped = 0;
  for (const doc of backup.docs) {
    const hasRatingSets = doc.ratingSets && doc.ratingSets.length > 0;
    const hasRatings = doc.ratings && doc.ratings.length > 0;
    const hasMedia = doc.media && doc.media.length > 0;
    if (!hasRatingSets && !hasRatings && !hasMedia) {
      skipped++;
      continue;
    }

    const data: Record<string, unknown> = {};
    // Session-level reps/passes used to apply to every set equally.
    const work = { reps: doc.reps ?? null, passes: doc.passes ?? null };

    if (hasRatingSets) {
      data.sets = doc.ratingSets!.map((s) => ({
        setNumber: s.setNumber,
        ...work,
        ratings: (s.ratings ?? []).map((r) => ({ key: r.key, score: r.score })),
      }));
    } else if (hasRatings) {
      data.sets = [
        {
          setNumber: 1,
          ...work,
          ratings: doc.ratings!.map((r) => ({ key: r.key, score: r.score })),
        },
      ];
    }
    if (hasMedia) {
      data.media = doc.media!.map((m, i) => ({
        setNumber: setNumberFor(m),
        type: m.type,
        file: m.file,
        label: m.label ?? null,
        notes: m.notes ?? null,
        duration: m.duration ?? null,
        order: m.order ?? i + 1,
      }));
    }

    await payload.update({ collection: "sessions", id: doc.id, data });
    migrated++;
  }

  payload.logger.info(
    `Migrated ${migrated} session(s), skipped ${skipped} (nothing to carry over).`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
