import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";

// The login is a single shared password — this is just a stable internal
// key for the one admin row, never shown or asked for anywhere in the UI.
const ADMIN_EMAIL = "admin@srscontrols.local";

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const direct = process.argv.find((a) => a.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const password = getArg("password");

  if (!password) {
    console.error("Usage: pnpm run create-admin -- --password 'yourpassword'");
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [existing] = await db.select().from(usersTable).limit(1);
  if (existing) {
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, existing.id));
    console.log("Updated admin password.");
  } else {
    await db.insert(usersTable).values({ email: ADMIN_EMAIL, passwordHash });
    console.log("Created admin login.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
