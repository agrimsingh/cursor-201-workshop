// Errors raised by the domain layer. lib/http/errors.ts maps them to HTTP responses.

export type DomainErrorCode =
  | "INVALID_TRANSITION"
  | "BUSINESS_RULE"
  | "CURRENCY_MISMATCH"
  | "OVER_ALLOCATION"
  | "FORBIDDEN"
  | "NOT_FOUND";

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super("NOT_FOUND", `${entity} ${id} was not found`, { entity, id });
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("FORBIDDEN", message, details);
    this.name = "ForbiddenError";
  }
}
