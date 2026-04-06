import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to set your Supabase connection string?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
export const db = drizzle(pool, { schema });

export async function ensureDatabaseSchema() {
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS approved_at timestamp,
    ADD COLUMN IF NOT EXISTS approved_by text,
    ADD COLUMN IF NOT EXISTS rejection_reason text
  `);
}

export * from "./schema";
