import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Card S1-15: accessibility of the lookup and checkout pages. Every state of both pages is
 * scanned with axe (WCAG 2.2 A/AA rules) in light and dark mode; serious or critical findings
 * fail the test. A keyboard-only walkthrough checks that a payment can be made without a
 * mouse and that every stop shows a visible focus ring.
 */

async function expectNoSeriousViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  const report = serious.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(" ")).join("\n  ")}`,
  );
  expect(report, `${label}: serious/critical axe findings`).toEqual([]);
}

const PAYER = {
  "Name on the card": "Jordan Lee",
  Email: "jordan@example.com",
  "Street address": "1200 Market St",
  City: "St. Louis",
  "ZIP code": "63103",
};

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} mode`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
    });

    test("lookup page: empty, inline errors, and the open state list", async ({ page }) => {
      await page.goto("/");
      await expectNoSeriousViolations(page, "lookup empty");

      await page.getByLabel("Ticket number, license plate, or VIN").fill("1HGCM82643A004352");
      await page.getByRole("button", { name: "Search" }).click();
      await expect(page.getByText("This VIN has a mistake in it")).toBeVisible();
      await expectNoSeriousViolations(page, "lookup with check-digit error");

      await page.getByLabel("Ticket number, license plate, or VIN").fill("ABC1234");
      await page.getByRole("button", { name: "Search" }).click();
      await expect(page.getByText("Choose the state on the license plate.")).toBeVisible();
      await expectNoSeriousViolations(page, "lookup with missing-state error");

      await page.getByRole("combobox", { name: /Plate state/ }).pressSequentially("new");
      await expect(page.getByRole("listbox")).toBeVisible();
      await expectNoSeriousViolations(page, "state list open");
    });

    test("each lookup outcome", async ({ page }) => {
      for (const [name, url] of [
        ["found", "/results?q=ABC1234&state=MO"],
        ["near match", "/results?q=A8C1234&state=MO"],
        ["no open citations", "/results?q=XYZ789&state=IL"],
        ["unknown identifier", "/results?q=QQQ999&state=MO"],
        ["invalid format", "/results?q=1HGCM82643A004352"],
        ["rate limited", "/results?q=RATELIM&state=MO"],
      ]) {
        await page.goto(url!);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expectNoSeriousViolations(page, name!);
      }
    });

    test("checkout: empty, every error shown, and after a decline", async ({ page }) => {
      await page.goto("/pay/5c0d7e1a-3b2f-4d6a-8e90-000000000001");
      await expectNoSeriousViolations(page, "checkout empty");

      await page.getByRole("button", { name: "Pay $55.00" }).click();
      await expect(page.getByText("Enter the card number.")).toBeVisible();
      await expectNoSeriousViolations(page, "checkout with errors");

      for (const [label, value] of Object.entries(PAYER)) {
        await page.getByLabel(label, { exact: true }).fill(value);
      }
      await page.getByRole("combobox", { name: "State" }).fill("MO");
      await page.keyboard.press("Tab");
      await page.getByLabel("Card number").fill("4000000000000002");
      await page.getByLabel("Expiry (MM/YY)").fill("12/30");
      await page.getByLabel("Security code").fill("123");
      await page.getByRole("button", { name: "Pay $55.00" }).click();
      await expect(page.getByRole("alert")).toContainText("declined", { timeout: 15_000 });
      await expectNoSeriousViolations(page, "checkout after decline");
    });
  });
}

test.describe("keyboard only", () => {
  /** The focused element must show a ring: an outline or a box-shadow. */
  async function expectFocusVisible(page: Page) {
    const ring = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return { ok: false, what: "nothing focused" };
      const s = getComputedStyle(el);
      const ok =
        (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none";
      return {
        ok,
        what: `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}"`,
      };
    });
    expect(ring.ok, `no visible focus ring on ${ring.what}`).toBe(true);
  }

  async function tabTo(page: Page, accessibleName: RegExp, max = 25) {
    for (let i = 0; i < max; i++) {
      await page.keyboard.press("Tab");
      await expectFocusVisible(page);
      const name = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const label = el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent : null;
        return (label ?? el.getAttribute("aria-label") ?? el.textContent ?? "").trim();
      });
      if (accessibleName.test(name)) return;
    }
    throw new Error(`Never reached ${accessibleName} by pressing Tab`);
  }

  test("a resident can look up and pay without a mouse, always seeing where focus is", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Find your parking citation");

    await tabTo(page, /Skip to main content/);
    await tabTo(page, /^Ticket number, license plate, or VIN$/);
    await page.keyboard.type("ABC1234");
    await tabTo(page, /^Plate state/);
    await page.keyboard.type("MO");
    await tabTo(page, /^Search$/);
    await expect(page.getByRole("combobox", { name: /Plate state/ })).toHaveValue("Missouri (MO)");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("2 open citations");
    // Focus moved to the new page's heading, so screen readers announce it.
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();

    await tabTo(page, /Pay \$55\.00 for ticket T00012345/);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pay your citation");

    for (const [label, value] of [
      ...Object.entries(PAYER).slice(0, 4),
      ["State", "MO"],
      ["ZIP code", "63103"],
      ["Card number", "4242424242424242"],
      ["Expiry (MM/YY)", "12/30"],
      ["Security code", "123"],
    ] as const) {
      await tabTo(page, new RegExp(`^${label.replace(/[()]/g, "\\$&")}`));
      await page.keyboard.type(value);
    }
    await tabTo(page, /^Pay \$55\.00$/);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Payment received", {
      timeout: 15_000,
    });
  });
});
