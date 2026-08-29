import { expect, test } from "@playwright/test";

test("a visitor can sign up, sign in, and reach the household leaderboard", async ({ page }) => {
  const uniqueEmail = `browser-smoke-${Date.now()}@novus.demo`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
  await page.getByRole("link", { name: "Create an account" }).click();

  await expect(page).toHaveURL(/\/sign-up$/);
  await page.getByLabel("Full name").fill("Browser Test Resident");
  await page.getByLabel("Email address").fill(uniqueEmail);
  await page.getByLabel("Password", { exact: true }).fill("testpass123");
  await page.getByLabel("Confirm password", { exact: true }).fill("testpass123");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("status")).toContainText("Account created");
  await page.getByLabel("Email address").fill(uniqueEmail);
  await page.getByLabel("Password", { exact: true }).fill("testpass123");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/leaderboard$/);
  await expect(page.getByRole("heading", { name: "Household energy leaderboard" })).toBeVisible();
  await expect(page.getByText("Household-level only")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Household" })).toBeVisible();
});

test("a member can rank rooms inside only their households", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email address").fill("resident1@novus.demo");
  await page.getByLabel("Password", { exact: true }).fill("demo1234");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/leaderboard$/);
  await page.getByRole("tab", { name: "Rooms" }).click();
  await expect(page.getByRole("heading", { name: "Room energy leaderboard" })).toBeVisible();
  await expect(page.getByText("Members-only room view")).toBeVisible();

  const householdPicker = page.getByLabel("Household");
  await expect(householdPicker.locator("option")).toHaveText([
    "Meadow Residence",
    "Verdant House",
  ]);
  await householdPicker.selectOption({ label: "Verdant House" });

  const roomTable = page.getByRole("table");
  await expect(roomTable.getByRole("columnheader", { name: "Room" })).toBeVisible();
  await expect(roomTable.locator("tbody tr").first()).toContainText("Fern Room");
  await expect(roomTable).toContainText("Canopy Room");
  await expect(roomTable).not.toContainText("Avery Tan");
  await expect(roomTable).not.toContainText("Jordan Lim");

  await page.getByRole("button", { name: "Daily" }).click();
  await expect(roomTable.locator("tbody tr").first()).toContainText("Fern Room");
});
