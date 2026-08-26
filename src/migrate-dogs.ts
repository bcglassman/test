/**
 * One-time migration for the dogs change.
 *
 * Unlike the ratings migration, this one needs no backup file: `dog` is a
 * new, optional column, so the schema push leaves every existing session
 * intact — they just have no dog attached. This script creates a dog if
 * there isn't one and points those orphaned sessions at it.
 *
 * It also stamps a role onto accounts created before roles existed. Roles
 * only decide which navigation and screens a person sees; they don't
 * change what the API returns.
 *
 * Safe to re-run: sessions that already have a dog and users that already
 * have a role are left alone.
 *
 * Usage (after deploying):
 *   npx tsx --env-file=.env.local src/migrate-dogs.ts [dog name]
 */
import { getPayload } from "payload";
import config from "./payload.config";

async function main() {
  const dogName = process.argv[2] || "Cookie";
  const payload = await getPayload({ config });

  const existingDogs = await payload.find({
    collection: "dogs",
    limit: 1,
    sort: "createdAt",
  });
  const dog =
    existingDogs.docs[0] ??
    (await payload.create({ collection: "dogs", data: { name: dogName } }));
  if (existingDogs.docs.length === 0) {
    payload.logger.info(`Created dog "${dog.name}" (id ${dog.id}).`);
  } else {
    payload.logger.info(`Using existing dog "${dog.name}" (id ${dog.id}).`);
  }

  const orphaned = await payload.find({
    collection: "sessions",
    where: { dog: { exists: false } },
    limit: 500,
    depth: 0,
  });
  for (const session of orphaned.docs) {
    await payload.update({
      collection: "sessions",
      id: session.id,
      data: { dog: dog.id },
    });
  }
  payload.logger.info(
    `Attached ${orphaned.docs.length} session(s) to "${dog.name}".`,
  );

  // The only accounts predating roles belong to whoever set the site up,
  // so they become admins rather than being demoted out of their own
  // admin area. New accounts default to "owner" via the field's default.
  const rolelessUsers = await payload.find({
    collection: "users",
    where: { role: { exists: false } },
    limit: 200,
    depth: 0,
  });
  for (const user of rolelessUsers.docs) {
    await payload.update({
      collection: "users",
      id: user.id,
      data: { role: "admin" },
    });
  }
  payload.logger.info(
    `Set ${rolelessUsers.docs.length} pre-existing user(s) to the admin role.`,
  );

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
