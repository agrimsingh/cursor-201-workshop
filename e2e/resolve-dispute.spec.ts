import { expect, test, type Page } from "@playwright/test";
import { actAs } from "./helpers";

// Earlier specs change which disputes are active, so pick whichever one is active right now.
async function openActiveDispute(page: Page) {
  for (const status of ["open", "under_review"]) {
    await page.goto(`/disputes?status=${status}`);
    const rows = page.getByTestId("dispute-row");
    if ((await rows.count()) > 0) {
      await rows.first().getByRole("link").first().click();
      await expect(page).toHaveURL(/\/disputes\/[^/?]+$/);
      return;
    }
  }
  throw new Error("No active dispute left to resolve");
}

test("[resolve-dispute] agents cannot resolve a dispute", async ({ page }) => {
  await openActiveDispute(page);
  await actAs(page, "Marcus Lee");
  await expect(page.getByRole("button", { name: "Mark withdrawn" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resolve dispute" })).toHaveCount(0);
});

test("[resolve-dispute] an admin accepts a dispute and sees it resolved with the note and history", async ({ page }) => {
  const note = "Customer sent proof of the error; crediting the disputed amount.";
  await openActiveDispute(page);
  await actAs(page, "Dana Okafor");

  await page.getByRole("button", { name: "Resolve dispute" }).click();
  const dialog = page.getByRole("dialog", { name: "Resolve dispute" });
  await dialog.getByLabel(/^Accept: credit/).check();
  await dialog.getByLabel("Resolution note").fill(note);
  await dialog.getByRole("button", { name: "Resolve", exact: true }).click();

  await expect(page.getByRole("main").getByTestId("status-badge").first()).toHaveText("Resolved");
  await expect(page.getByTestId("dispute-resolution")).toContainText(note);
  await expect(page.getByTestId("audit-trail")).toContainText("Dispute resolved");
  await expect(page.getByTestId("audit-trail")).toContainText("Resolved (accepted)");
  await expect(page.getByRole("button", { name: "Resolve dispute" })).toHaveCount(0);
});
