import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TestProject } from "vitest/node";
import { recreateSqliteDatabase } from "../../prisma/reset-sqlite";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

// Creates a throwaway SQLite database for the integration suite.
// Your dev database (prisma/dev.db) is never touched.
export default function setup(project: TestProject) {
  const dir = mkdtempSync(path.join(tmpdir(), "tally-test-"));
  const url = `file:${path.join(dir, "test.db")}`;
  recreateSqliteDatabase(url);
  project.provide("databaseUrl", url);
  return () => rmSync(dir, { recursive: true, force: true });
}
