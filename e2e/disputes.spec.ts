import { expect, test } from "@playwright/test";
import { actAs, findInvoices } from "./helpers";

test("opens a dispute and takes the invoice out of the collections queue", async ({ page, request }) => {
  const invoice = (await findInvoices(request, { status: "overdue", q: "Pinnacle" })).find((i) => !i.inDispute)!;
  await page.goto("/collections");
  await page.getByTestId("collections-queue").getByRole("link", { name: invoice.number }).click();
  await expect(page).toHaveURL(new RegExp(`/invoices/${invoice.id}$`));
  await page.getByRole("button", { name: "Open dispute" }).click();
  const dialog = page.getByRole("dialog", { name: "Open dispute" });
  await dialog.getByLabel("Amount").fill("250.00");
  await dialog.getByLabel("Reason").selectOption("pricing");
  await dialog.getByLabel("What is the customer disputing?").fill("Retainer was billed at the old rate.");
  await dialog.getByRole("button", { name: "Open dispute" }).click();

  await expect(page.getByText("In dispute").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Open dispute" })).toHaveCount(0);
  await page.getByRole("link", { name: "Pricing dispute" }).click();
  await expect(page.getByTestId("dispute-details")).toContainText("Retainer was billed at the old rate.");
  await expect(page.getByTestId("audit-trail")).toContainText("Dispute opened");

  await page.goto("/collections");
  await expect(page.getByTestId("collections-queue")).not.toContainText(invoice.number);
});

test("starts a review on an open dispute", async ({ page }) => {
  await page.goto("/disputes?status=open");
  await page.getByTestId("dispute-row").first().getByRole("link").first().click();
  await page.getByRole("button", { name: "Start review" }).click();
  await expect(page.getByRole("main").getByTestId("status-badge").first()).toHaveText("Under review");
});

test("viewers can look but not touch", async ({ page, request }) => {
  const [invoice] = await findInvoices(request, { status: "overdue", q: "Atlas" });
  await page.goto(`/invoices/${invoice.id}`);
  await actAs(page, "Priya Shah");
  await expect(page.getByRole("button", { name: "Open dispute" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Record payment" })).toHaveCount(0);
  await expect(page.getByText("History")).toHaveCount(0);
  await actAs(page, "Marcus Lee");
  await expect(page.getByRole("link", { name: "Record payment" })).toBeVisible();
});
