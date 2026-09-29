import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** Lazy singleton so `next build` succeeds without a database present. */
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function db() {
  if (_db === null) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _db = drizzle(postgres(url), { schema });
  }
  return _db;
}
