import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError, type DomainErrorCode } from "@/lib/domain/errors";

// Every API error response has the same shape:
//   { "error": { "code": "VALIDATION_FAILED", "message": "...", "details": ... } }

export type ApiErrorCode = DomainErrorCode | "VALIDATION_FAILED" | "BAD_REQUEST" | "INTERNAL";

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
}

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_FAILED: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID_TRANSITION: 409,
  BUSINESS_RULE: 422,
  CURRENCY_MISMATCH: 422,
  OVER_ALLOCATION: 422,
  INTERNAL: 500,
};

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function statusForCode(code: ApiErrorCode): number {
  return STATUS_BY_CODE[code];
}

export function errorBody(code: ApiErrorCode, message: string, details?: unknown): ApiErrorBody {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}

export function toErrorResponse(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
    return NextResponse.json(errorBody("VALIDATION_FAILED", "Request validation failed", details), { status: 400 });
  }
  if (error instanceof ApiError || error instanceof DomainError) {
    return NextResponse.json(errorBody(error.code, error.message, error.details), {
      status: statusForCode(error.code),
    });
  }
  console.error(error);
  return NextResponse.json(errorBody("INTERNAL", "Something went wrong"), { status: 500 });
}
