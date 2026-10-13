import { expect, test } from "@playwright/test";

test.describe("invoices list", () => {
  test("pages through invoices server-side", async ({ page }) => {
    await page.goto("/invoices");
    await expect(page.getByTestId("invoice-row")).toHaveCount(20);
    await expect(page.getByTestId("invoice-count")).toHaveText(/\d+ invoices · page 1 of \d+/);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId("invoice-count")).toHaveText(/page 2 of/);
  });

  test("sorts by balance", async ({ page }) => {
    await page.goto("/invoices");
    await page.getByRole("button", { name: "Balance" }).click();
    await expect(page).toHaveURL(/sort=balanceMinor/);
    await page.getByRole("button", { name: /Balance/ }).click();
    await expect(page).toHaveURL(/order=desc/);
    await expect(page.getByTestId("invoice-row").first()).not.toContainText("$0.00");
  });

  test("[filter-bug] filters invoices by status", async ({ page }) => {
    await page.goto("/invoices");
    await expect(page.getByTestId("invoice-row")).toHaveCount(20);
    const response = page.waitForResponse((r) => r.url().includes("/api/invoices?") && r.url().includes("overdue"));
    await page.getByLabel("Status").selectOption("overdue");
    await response;
    const rowStatuses = async () =>
      (await page.getByTestId("invoice-row").getByTestId("status-badge").allTextContents()).filter((s) => s !== "In dispute");
    await expect.poll(rowStatuses, { timeout: 5_000 }).not.toHaveLength(0);
    await expect.poll(async () => [...new Set(await rowStatuses())], { timeout: 5_000 }).toEqual(["Overdue"]);
  });

  test("searches by customer", async ({ page }) => {
    await page.goto("/invoices");
    await page.getByLabel("Search").fill("Sakura");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/q=Sakura/);
    await expect(page.getByTestId("invoice-row")).not.toHaveCount(0);
    for (const row of await page.getByTestId("invoice-row").all()) {
      await expect(row).toContainText("Sakura Stationery KK");
    }
  });
});
