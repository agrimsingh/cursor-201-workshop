#!/usr/bin/env node
// Starts Tally for the Playwright suite against its own freshly seeded database
// (prisma/e2e.db) on port 3100, so e2e runs never touch prisma/dev.db. It builds into
// .next-e2e so it can run while your own `npm run dev` is up.
import { execSync, spawn } from "node:child_process";

const port = process.env.E2E_PORT ?? "3100";
const env = {
  ...process.env,
  DATABASE_URL: "file:./prisma/e2e.db",
  NEXT_DIST_DIR: ".next-e2e",
  NEXT_TELEMETRY_DISABLED: "1",
};

execSync("npx prisma db seed", { stdio: "inherit", env });

const server = spawn("npx", ["next", "dev", "--port", port], { stdio: "inherit", env, shell: process.platform === "win32" });
const stop = () => server.kill("SIGTERM");
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => process.exit(code ?? 0));
