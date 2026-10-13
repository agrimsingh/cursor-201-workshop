import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Recreates a local SQLite database file from prisma/schema.prisma.
//
// Tally's database is a throwaway demo file, so "reset" means deleting the file and pushing
// the schema into a fresh one. This refuses to touch anything that is not a SQLite file in
// this repo's prisma/ folder or the OS temp folder.
export function recreateSqliteDatabase(url: string): string {
  if (!url.startsWith("file:")) throw new Error(`Refusing to reset non-SQLite database: ${url}`);
  const file = path.resolve(process.cwd(), url.slice("file:".length));
  const allowedRoots = [path.resolve(process.cwd(), "prisma"), path.resolve(tmpdir())];
  if (!file.endsWith(".db") || !allowedRoots.some((root) => file.startsWith(root + path.sep))) {
    throw new Error(`Refusing to reset ${file}: only *.db files under prisma/ or the temp folder are allowed`);
  }
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    if (existsSync(file + suffix)) rmSync(file + suffix);
  }
  execSync(`npx prisma db push --url "${url}"`, { stdio: "inherit" });
  return file;
}
