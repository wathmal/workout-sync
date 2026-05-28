import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/food/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://workout:workout@localhost:5433/workout",
  },
  strict: true,
  verbose: true,
});
