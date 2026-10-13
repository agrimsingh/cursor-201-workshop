import { inject } from "vitest";

// Runs before each integration test file, before lib/db is imported.
process.env.DATABASE_URL = inject("databaseUrl");
