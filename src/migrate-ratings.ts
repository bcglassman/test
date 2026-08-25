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

interface OldSessionDoc {
  id: number;
  ratings?: OldRating[];
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
    if (!doc.ratings || doc.ratings.length === 0) {
      skipped++;
      continue;
    }
    await payload.update({
      collection: "sessions",
      id: doc.id,
      data: {
        ratingSets: [
          {
            setNumber: 1,
            ratings: doc.ratings.map((r) => ({ key: r.key, score: r.score })),
          },
        ],
      },
    });
    migrated++;
  }

  payload.logger.info(
    `Migrated ${migrated} session(s) to ratingSets, skipped ${skipped} (no ratings data).`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
