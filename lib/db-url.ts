// SQLite file used by the app, the Prisma CLI and the seed script.
// Tests point DATABASE_URL at a throwaway file; nobody needs to set it for local dev.
export const DEFAULT_DATABASE_URL = "file:./prisma/dev.db";

export function databaseUrl(): string {
  return process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}
