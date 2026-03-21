import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import * as relations from "./relations";

const connectionString = process.env.SUPABASE_DB_URL!;

const client = postgres(connectionString, { prepare: false, max: 5, idle_timeout: 20 });

export const db = drizzle(client, { schema: { ...schema, ...relations } });
