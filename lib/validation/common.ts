import { z } from "zod";
import { CURRENCIES } from "@/lib/money";

// Prisma `Int` columns are 32-bit; cap amounts well below that.
export const MAX_MINOR_UNITS = 2_000_000_000;

export const idSchema = z.string().trim().min(1).max(64);
export const idParamsSchema = z.object({ id: idSchema });

export const currencySchema = z.enum(CURRENCIES);

export const positiveMinorSchema = z
  .number({ error: "Amounts are integers in minor units (for example cents)" })
  .int("Amounts are integers in minor units (for example cents)")
  .positive()
  .max(MAX_MINOR_UNITS);

/** Accepts "2026-10-13" or a full ISO timestamp and returns a Date. */
export const dateSchema = z.union([z.iso.date(), z.iso.datetime({ offset: true })]).transform((value) => new Date(value));

export const pageSchema = z.coerce.number().int().min(1).default(1);
export const pageSizeSchema = z.coerce.number().int().min(1).max(100).default(20);
export const sortOrderSchema = z.enum(["asc", "desc"]);

export const optionalQueryString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));
