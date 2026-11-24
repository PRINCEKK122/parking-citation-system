import { expect, test } from "@playwright/test";

/**
 * T3 (midterm test plan): typing "MO" in the state field selects Missouri. This is the
 * regression from the St. Louis portal, where it selected Montana.
 */

test("T3: typing MO selects Missouri, not Montana", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Ticket number, license plate, or VIN").fill("ABC1234");

  const state = page.getByRole("combobox", { name: /Plate state/ });
  await state.click();
  await state.pressSequentially("MO");

  // Missouri is highlighted first, Montana second.
  const options = page.getByRole("option");
  await expect(options.nth(0)).toContainText("Missouri");
  await expect(options.nth(1)).toContainText("Montana");
  await expect(page.getByRole("option", { selected: true })).toContainText("Missouri");

  await page.keyboard.press("Tab");
  await expect(state).toHaveValue("Missouri (MO)");

  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/results\?q=ABC1234&state=MO$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("2 open citations");
});

test("T3: full names work too, and Enter picks the highlighted state", async ({ page }) => {
  await page.goto("/");
  const state = page.getByRole("combobox", { name: /Plate state/ });
  await state.click();
  await state.pressSequentially("missou");
  await page.keyboard.press("Enter");
  await expect(state).toHaveValue("Missouri (MO)");
  // Enter chose the state; it did not submit the search.
  await expect(page).toHaveURL(/\/$/);
});
