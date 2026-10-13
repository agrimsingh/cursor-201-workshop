import { db } from "@/lib/db";

export async function listUsers() {
  return db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, role: true } });
}
