import { expect, type APIRequestContext, type Page } from "@playwright/test";
import type { InvoiceListItem } from "@/lib/services/invoices";

export async function findInvoices(request: APIRequestContext, query: Record<string, string>): Promise<InvoiceListItem[]> {
  const response = await request.get(`/api/invoices?${new URLSearchParams({ pageSize: "100", ...query })}`);
  expect(response.ok()).toBeTruthy();
  return (await response.json()).data;
}

export async function actAs(page: Page, name: "Priya Shah" | "Marcus Lee" | "Dana Okafor") {
  const select = page.getByLabel("Acting as");
  const option = select.locator("option", { hasText: name });
  await select.selectOption({ value: (await option.getAttribute("value"))! });
  await expect(select.locator("option:checked")).toHaveText(new RegExp(name));
}

export function minorFromText(text: string): number {
  return Math.round(Number(text.replace(/[^0-9.-]/g, "")) * 100);
}
