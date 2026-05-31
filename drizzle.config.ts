import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./lib/db/schema/food.ts", "./lib/db/schema/race.ts", "./lib/db/schema/agenda.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://workout:workout@localhost:5433/workout",
  },
  strict: true,
  verbose: true,
});
