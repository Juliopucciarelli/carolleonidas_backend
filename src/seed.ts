import bcrypt from "bcrypt";
import { env } from "./env.js";
import { pool } from "./db.js";

export async function runSeed(): Promise<void> {
  const { rows } = await pool.query(
    "SELECT 1 FROM admin_users WHERE email = $1",
    [env.ADMIN_SEED_EMAIL]
  );
  if (rows.length > 0) return;

  const passwordHash = await bcrypt.hash(env.ADMIN_SEED_PASSWORD, 12);
  await pool.query(
    "INSERT INTO admin_users (email, password_hash) VALUES ($1, $2)",
    [env.ADMIN_SEED_EMAIL, passwordHash]
  );
  console.log(`[seed] created admin user ${env.ADMIN_SEED_EMAIL}`);
}
