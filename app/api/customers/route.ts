import { handle, ok } from "@/lib/http/route";
import { listCustomers } from "@/lib/services/customers";

export const GET = handle(async () => ok(await listCustomers()));
