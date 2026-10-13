import { databaseUrl } from "../lib/db-url";
import { recreateSqliteDatabase } from "./reset-sqlite";

// `npx prisma db seed` entry point. Recreates the local SQLite file from prisma/schema.prisma,
// then loads the demo data. Safe to re-run at any time (for example after switching branches).

async function main() {
  const url = databaseUrl();
  console.log(`Recreating ${url} ...`);
  recreateSqliteDatabase(url);

  const { seedDemoData } = await import("./demo-data");
  const { db } = await import("../lib/db");
  await seedDemoData(new Date());

  const [customers, invoices, payments, disputes, auditEntries] = await Promise.all([
    db.customer.count(),
    db.invoice.count(),
    db.payment.count(),
    db.dispute.count(),
    db.auditEntry.count(),
  ]);
  console.log(
    `Seeded ${customers} customers, ${invoices} invoices, ${payments} payments, ${disputes} disputes, ${auditEntries} audit entries.`,
  );
  console.log("If `npm run dev` is already running, restart it so it opens the new database.");
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
