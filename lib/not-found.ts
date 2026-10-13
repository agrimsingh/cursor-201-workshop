import { notFound } from "next/navigation";
import { NotFoundError } from "@/lib/domain/errors";

/** Server components: turn a service NotFoundError into the Next.js 404 page. */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}
