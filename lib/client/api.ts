import type { ApiErrorBody } from "@/lib/http/errors";

// Tiny fetch wrapper for client components. Unwraps `{ data }` and turns the
// standard error shape into an ApiClientError with a readable message.

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function apiRequest<T>(method: "GET" | "POST" | "PUT", url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as ({ data: T } & Partial<ApiErrorBody>) | null;
  if (!response.ok || !payload) {
    const error = payload?.error;
    throw new ApiClientError(response.status, error?.code ?? "INTERNAL", error?.message ?? "Request failed", error?.details);
  }
  return payload.data;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError && Array.isArray(error.details) && error.code === "VALIDATION_FAILED") {
    const first = error.details[0] as { path?: string; message?: string } | undefined;
    if (first?.message) return `${error.message}: ${first.path ? `${first.path} ` : ""}${first.message}`;
  }
  return error instanceof Error ? error.message : "Something went wrong";
}
