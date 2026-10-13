import { expect, test } from "@playwright/test";
import { findInvoices, minorFromText } from "./helpers";

test("records a partial payment from the invoice page", async ({ page, request }) => {
  const [invoice] = await findInvoices(request, { status: "overdue", q: "Kookaburra" });
  await page.goto(`/invoices/${invoice.id}`);
  const balanceBefore = minorFromText(await page.getByTestId("invoice-balance").innerText());

  await page.getByRole("link", { name: "Record payment" }).click();
  await expect(page).toHaveURL(/\/payments\/new/);
  await page.getByLabel("Amount received").fill("100.00");
  await page.getByLabel(`Apply to ${invoice.number}`).fill("100.00");
  await page.getByLabel("Reference").fill("E2E-PARTIAL-001");
  await expect(page.getByTestId("allocation-preview")).toContainText("$100.00");
  await page.getByRole("button", { name: "Record payment" }).click();

  await expect(page).toHaveURL(new RegExp(`/invoices/${invoice.id}$`));
  await expect.poll(async () => minorFromText(await page.getByTestId("invoice-balance").innerText())).toBe(balanceBefore - 10_000);
  await expect(page.getByText("E2E-PARTIAL-001")).toBeVisible();
  await expect(page.getByTestId("audit-trail")).toContainText("Payment recorded");
});

test("rejects an over-allocation with a readable error", async ({ page, request }) => {
  const [invoice] = await findInvoices(request, { status: "overdue", q: "Thames" });
  await page.goto(`/payments/new?customerId=${invoice.customer.id}&invoiceId=${invoice.id}`);
  await page.getByLabel("Amount received").fill("999999.00");
  await page.getByLabel(`Apply to ${invoice.number}`).fill("999999.00");
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("exceeds the balance");
});
