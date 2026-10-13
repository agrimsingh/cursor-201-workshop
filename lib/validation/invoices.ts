import { z } from "zod";
import { INVOICE_STATUSES } from "@/lib/domain/invoice-status";
import {
  currencySchema,
  dateSchema,
  idSchema,
  MAX_MINOR_UNITS,
  optionalQueryString,
  pageSchema,
  pageSizeSchema,
  sortOrderSchema,
} from "@/lib/validation/common";

export const INVOICE_SORT_FIELDS = ["number", "customer", "issueDate", "dueDate", "totalMinor", "balanceMinor"] as const;
export type InvoiceSortField = (typeof INVOICE_SORT_FIELDS)[number];

/** Query string accepted by GET /api/invoices. */
export const invoiceListQuerySchema = z.object({
  status: z.enum(INVOICE_STATUSES).optional(),
  customerId: optionalQueryString,
  currency: currencySchema.optional(),
  q: optionalQueryString,
  sort: z.enum(INVOICE_SORT_FIELDS).default("dueDate"),
  order: sortOrderSchema.default("asc"),
  page: pageSchema,
  pageSize: pageSizeSchema,
});
export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;

export const invoiceLineInputSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.number().int().positive().max(100_000),
  unitPriceMinor: z.number().int().positive().max(MAX_MINOR_UNITS),
});

export const createInvoiceSchema = z.object({
  customerId: idSchema,
  currency: currencySchema,
  issueDate: dateSchema,
  dueDate: dateSchema,
  memo: z.string().trim().max(500).optional(),
  lines: z.array(invoiceLineInputSchema).min(1).max(50),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const invoiceTransitionSchema = z.object({
  action: z.enum(["send", "void"]),
});

export const markOverdueSchema = z.object({
  asOf: dateSchema.optional(),
});
