import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { databaseUrl } from "@/lib/db-url";

// The only place that constructs a PrismaClient. Everything else imports `db`.
// Next.js dev mode re-evaluates modules on every edit, so cache the client on
// globalThis to avoid exhausting SQLite file handles.
const globalForDb = globalThis as unknown as { tallyDb?: PrismaClient };

function createClient() {
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl() }) });
}

export const db: PrismaClient = globalForDb.tallyDb ?? createClient();

if (process.env.NODE_ENV !== "production") globalForDb.tallyDb = db;

export type Db = PrismaClient;
export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
