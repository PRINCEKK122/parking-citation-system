import { expect, test, type Page } from "@playwright/test";

/**
 * T4 (midterm test plan): decline a test card -> payment failed; name, email and address
 * are preserved and the card field is empty (user story US2).
 */

const PAYER = {
  "Name on the card": "Jordan Lee",
  Email: "jordan@example.com",
  "Street address": "1200 Market St",
  City: "St. Louis",
  "ZIP code": "63103",
};

async function fillCard(page: Page, number: string) {
  await page.getByLabel("Card number").fill(number);
  await page.getByLabel("Expiry (MM/YY)").fill("12/30");
  await page.getByLabel("Security code").fill("123");
}

test("T4: a declined card keeps every field except the card", async ({ page }) => {
  await page.goto("/results?q=ABC1234&state=MO");
  await page.getByRole("link", { name: "Pay $55.00 for ticket T00012345" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pay your citation");

  for (const [label, value] of Object.entries(PAYER))
    await page.getByLabel(label, { exact: true }).fill(value);
  const state = page.getByRole("combobox", { name: "State" });
  await state.fill("MO");
  await state.press("Tab");
  await fillCard(page, "4000 0000 0000 0002"); // declined test card

  await page.getByRole("button", { name: "Pay $55.00" }).click();
  await expect(page.getByRole("heading", { name: "Confirming your payment" })).toBeVisible();

  // The status page sees the decline and returns to checkout.
  await expect(page.getByRole("alert")).toContainText(
    "Your card was declined, so nothing was charged.",
    {
      timeout: 15_000,
    },
  );
  await expect(page).toHaveURL(/\/pay\/5c0d7e1a-3b2f-4d6a-8e90-000000000001$/);

  for (const [label, value] of Object.entries(PAYER)) {
    await expect(page.getByLabel(label, { exact: true })).toHaveValue(value);
  }
  await expect(state).toHaveValue("Missouri (MO)");
  await expect(page.getByLabel("Card number")).toHaveValue("");
  await expect(page.getByLabel("Expiry (MM/YY)")).toHaveValue("");
  await expect(page.getByLabel("Security code")).toHaveValue("");

  // Only the card needs typing again; then the payment goes through.
  await fillCard(page, "4242 4242 4242 4242");
  await page.getByRole("button", { name: "Pay $55.00" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Payment received", {
    timeout: 15_000,
  });
  await expect(page.getByRole("region", { name: "Receipt" })).toContainText("$55.00");
});
