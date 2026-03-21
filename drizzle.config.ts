import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.local", override: true });

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./supabase/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.SUPABASE_DB_URL!,
  },
});
