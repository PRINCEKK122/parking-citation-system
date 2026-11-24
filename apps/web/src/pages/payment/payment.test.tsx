import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { paths } from "../../paths.js";
import { CITATION, fillCard, fillPayer, input, open, payButton } from "../../test/checkout.js";
import { serveMockApi } from "../../test/mockApi.js";
import { findHeading, renderApp } from "../../test/renderApp.js";
import { polling } from "./polling.js";

/** Card S1-11: poll after 202, receipt on success, back to checkout on failure (F2, T4). */

const mock = serveMockApi();
const realDelays = polling.delaysMs;
beforeEach(() => {
  sessionStorage.clear();
  polling.delaysMs = [5];
});
afterEach(() => {
  polling.delaysMs = realDelays;
});

async function payWith(cardNumber: string) {
  const app = await open();
  await fillPayer(app.user);
  await fillCard(app.user, cardNumber);
  await app.user.click(payButton());
  return app;
}

describe("processing -> succeeded", () => {
  it("shows the receipt with payment ID, amount and time, and focuses its heading", async () => {
    const { router } = await payWith("4242 4242 4242 4242");
    const h1 = await findHeading("Payment received");
    const receipt = screen.getByRole("region", { name: "Receipt" });
    const paymentId = router.state.location.pathname.split("/").pop()!;

    expect(receipt.textContent).toContain("$55.00");
    expect(receipt.textContent).toContain("T00012345");
    expect(receipt.textContent).toContain(paymentId);
    expect(receipt.textContent).toMatch(/Paid on\w{3} \d{1,2}, \d{4}, \d{1,2}:\d{2} [AP]M C[SD]T/);
    await waitFor(() => expect(document.activeElement).toBe(h1));
  });

  it("forgets the saved payer details once paid", async () => {
    await payWith("4242 4242 4242 4242");
    await findHeading("Payment received");
    expect(sessionStorage.length).toBe(0);
  });

  it("says when it's taking longer than usual, then still shows the receipt", async () => {
    polling.delaysMs = [40];
    await payWith("4000 0000 0000 0077"); // settles after 6 checks
    expect(await screen.findByText(/taking longer than usual/, {}, { timeout: 2000 })).toBeTruthy();
    await findHeading("Payment received");
  });

  it("keeps checking through a dropped connection", async () => {
    polling.delaysMs = [40];
    await payWith("4000 0000 0000 0077"); // slow card: several checks before it settles
    await findHeading("Confirming your payment");
    mock.server.use(http.get("/api/payments/:id", () => HttpResponse.error(), { once: true }));
    expect(await screen.findByText(/Lost the connection for a moment/)).toBeTruthy();
    await findHeading("Payment received");
  });
});

describe("processing -> failed: back to checkout (T4 end to end)", () => {
  it("a declined card returns to checkout with every field kept except the card", async () => {
    const { router } = await payWith("4000 0000 0000 0002");

    expect((await screen.findByRole("alert", {}, { timeout: 2000 })).textContent).toContain(
      "Your card was declined, so nothing was charged.",
    );
    expect(router.state.location.pathname).toBe(paths.checkout(CITATION));
    expect(input("Name on the card").value).toBe("Jordan Lee");
    expect(input("Email").value).toBe("jordan@example.com");
    expect(input("Street address").value).toBe("1200 Market St");
    expect(input("City").value).toBe("St. Louis");
    expect(input("ZIP code").value).toBe("63103");
    expect(input("Card number").value).toBe("");
    expect(input("Security code").value).toBe("");

    // The failed status page was replaced, so it isn't in the history to go back to.
    expect(router.state.historyAction).toBe("REPLACE");
  });

  it("then paying with a good card works", async () => {
    const { user } = await payWith("4000 0000 0000 0002");
    await screen.findByRole("alert", {}, { timeout: 2000 });
    await fillCard(user);
    await user.click(payButton());
    await findHeading("Payment received");
    expect(mock.db.payments.filter((p) => p.citationId === CITATION).map((p) => p.state)).toEqual([
      "failed",
      "succeeded",
    ]);
  });

  it("a gateway error explains the processor failed, not the card", async () => {
    await payWith("4000 0000 0000 0119");
    expect((await screen.findByRole("alert", {}, { timeout: 2000 })).textContent).toContain(
      "problem with the payment processor",
    );
  });
});

describe("opening a status link directly", () => {
  it("shows a finished receipt without polling", async () => {
    const { router } = await payWith("4242 4242 4242 4242");
    await findHeading("Payment received");
    const url = router.state.location.pathname;
    renderApp(url);
    expect(
      (await screen.findAllByRole("heading", { name: "Payment received" })).length,
    ).toBeGreaterThan(0);
  });

  it("explains an unknown payment", async () => {
    renderApp(paths.paymentStatus("00000000-0000-4000-8000-000000000000"));
    await findHeading("Payment not found");
  });
});
