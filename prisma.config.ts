import { defineConfig } from "prisma/config";
import { databaseUrl } from "./lib/db-url";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    // `npx prisma db seed` rebuilds the schema from scratch and loads demo data,
    // so it is safe to re-run any time (for example after switching step branches).
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl(),
  },
});
