import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { IDEMPOTENCY_KEY_HEADER } from "@pcs/shared";
import { paths } from "../../paths.js";
import { serveMockApi } from "../../test/mockApi.js";
import { findHeading, renderApp } from "../../test/renderApp.js";

/** Card S1-10: checkout that survives errors (F2, US2, test T4). */

const mock = serveMockApi();
beforeEach(() => sessionStorage.clear());

const CITATION = "5c0d7e1a-3b2f-4d6a-8e90-000000000001"; // T00012345, $55.00
const FEE_CITATION = "5c0d7e1a-3b2f-4d6a-8e90-000000000005"; // FEE2026: late fee lands at payment
const PAID_CITATION = "5c0d7e1a-3b2f-4d6a-8e90-000000000004";

const input = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement;
const payButton = () => screen.getByRole("button", { name: /^Pay \$/ });

async function open(citationId = CITATION) {
  const app = renderApp(paths.checkout(citationId));
  await findHeading("Pay your citation");
  return app;
}

async function fillPayer(user: UserEvent) {
  await user.type(input("Name on the card"), "Jordan Lee");
  await user.type(input("Email"), "jordan@example.com");
  await user.type(input("Street address"), "1200 Market St");
  await user.type(input("City"), "St. Louis");
  await user.type(screen.getByRole("combobox", { name: "State" }), "MO");
  await user.tab();
  await user.type(input("ZIP code"), "63103");
}

async function fillCard(user: UserEvent, number = "4242 4242 4242 4242", expiry = "12/30") {
  await user.type(input("Card number"), number);
  await user.type(input("Expiry (MM/YY)"), expiry);
  await user.type(input("Security code"), "123");
}

describe("checkout page", () => {
  it("shows the citation's breakdown and the amount on the Pay button", async () => {
    await open();
    expect(screen.getByRole("article", { name: "Ticket T00012345" })).toBeTruthy();
    expect(payButton().textContent).toBe("Pay $55.00");
  });

  it("flags every missing field and focuses the first one", async () => {
    const { user } = await open();
    await user.click(payButton());
    await waitFor(() => expect(document.activeElement).toBe(input("Name on the card")));
    for (const msg of [
      "Enter the name on the card.",
      "Enter an email address like name@example.com.",
      "Enter a street address.",
      "Enter a city.",
      "Choose a state.",
      "Enter a 5-digit ZIP code.",
      "Enter the card number.",
      "Enter the expiry date as MM/YY, for example 04/29.",
      "Enter the 3 or 4 digit security code from the back of the card.",
    ]) {
      expect(screen.getByText(msg)).toBeTruthy();
    }
    expect(input("Email").getAttribute("aria-invalid")).toBe("true");
    expect(mock.db.payments).toHaveLength(1); // only the fixture's old payment
  });

  it("catches a mistyped card number and an expired card before contacting the gateway", async () => {
    const { user } = await open();
    await fillPayer(user);
    await fillCard(user, "4242 4242 4242 4241", "01/20");
    await user.click(payButton());
    expect(await screen.findByText("Check the card number. It doesn’t look right.")).toBeTruthy();
    expect(screen.getByText("This card has expired. Use a different card.")).toBeTruthy();
  });

  it("pays with a good card and goes to the payment status page", async () => {
    const { user, router } = await open();
    await fillPayer(user);
    await fillCard(user);
    await user.click(payButton());
    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/^\/payments\/[0-9a-f-]{36}$/),
    );
    const created = mock.db.payments.at(-1)!;
    expect(created).toMatchObject({ citationId: CITATION, amountCents: 5500, state: "processing" });
  });

  it("charges once when Pay is double-clicked: one key, one payment", async () => {
    const keys: string[] = [];
    mock.server.events.on("request:start", ({ request }) => {
      if (request.method === "POST" && new URL(request.url).pathname === "/api/payments") {
        keys.push(request.headers.get(IDEMPOTENCY_KEY_HEADER) ?? "");
      }
    });
    const { user } = await open();
    await fillPayer(user);
    await fillCard(user);
    await user.dblClick(payButton());
    await waitFor(() =>
      expect(mock.db.payments.filter((p) => p.citationId === CITATION)).toHaveLength(1),
    );
    expect(new Set(keys).size).toBe(1);
    mock.server.events.removeAllListeners();
  });

  it("keeps everything when the gateway refuses the card, and marks only the card number", async () => {
    const { user } = await open();
    await fillPayer(user);
    await fillCard(user, "4111 1111 1111 1111"); // valid number, but not a test card
    await user.click(payButton());
    expect(
      await screen.findByText(
        "This card wasn’t accepted. Check the number, or use a different card.",
      ),
    ).toBeTruthy();
    expect(input("Name on the card").value).toBe("Jordan Lee");
    expect(input("ZIP code").value).toBe("63103");
    expect(document.activeElement).toBe(input("Card number"));
  });
});

describe("T4: after a declined card, every field but the card is kept", () => {
  it("restores the payer's details, empties the card, and explains what happened", async () => {
    const { user, router } = await open();
    await fillPayer(user);
    await fillCard(user, "4000 0000 0000 0002");

    // The payment status page (card S1-11) sends the user back like this on a decline.
    await router.navigate(paths.checkout(CITATION), { state: { failure: "card_declined" } });
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Your card was declined, so nothing was charged.",
    );
    expect(input("Name on the card").value).toBe("Jordan Lee");
    expect(input("Email").value).toBe("jordan@example.com");
    expect(input("Street address").value).toBe("1200 Market St");
    expect(input("City").value).toBe("St. Louis");
    expect((screen.getByRole("combobox", { name: "State" }) as HTMLInputElement).value).toBe(
      "Missouri (MO)",
    );
    expect(input("ZIP code").value).toBe("63103");
    expect(input("Card number").value).toBe("");
    expect(input("Expiry (MM/YY)").value).toBe("");
    expect(input("Security code").value).toBe("");
  });

  it("never stores the card in the saved draft", async () => {
    const { user } = await open();
    await fillPayer(user);
    await fillCard(user);
    const stored = Object.values({ ...sessionStorage }).join(" ");
    expect(stored).toContain("Jordan Lee");
    expect(stored).not.toMatch(/4242|12\/30/);
  });
});

describe("server responses during checkout", () => {
  it("shows the new total when a late fee lands, then pays it with a fresh key", async () => {
    const { user, router } = await open(FEE_CITATION);
    expect(payButton().textContent).toBe("Pay $25.00");
    await fillPayer(user);
    await fillCard(user);
    await user.click(payButton());
    expect((await screen.findByRole("alert")).textContent).toContain("The amount due has changed");
    await waitFor(() => expect(payButton().textContent).toBe("Pay $35.00"));
    expect(input("Name on the card").value).toBe("Jordan Lee");

    await user.click(payButton());
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/payments\//));
    expect(mock.db.payments.at(-1)).toMatchObject({ citationId: FEE_CITATION, amountCents: 3500 });
  });

  it("after a dropped connection, Pay again resends the same key and charges once", async () => {
    const keys: string[] = [];
    mock.server.use(
      http.post(
        "/api/payments",
        ({ request }) => {
          keys.push(request.headers.get(IDEMPOTENCY_KEY_HEADER) ?? "");
          return HttpResponse.error();
        },
        { once: true },
      ),
    );
    mock.server.events.on("request:start", ({ request }) => {
      if (
        request.method === "POST" &&
        new URL(request.url).pathname === "/api/payments" &&
        keys.length === 1
      ) {
        keys.push(request.headers.get(IDEMPOTENCY_KEY_HEADER) ?? "");
      }
    });
    const { user, router } = await open();
    await fillPayer(user);
    await fillCard(user);
    await user.click(payButton());
    expect((await screen.findByRole("alert")).textContent).toContain("you won’t be charged twice");

    await user.click(payButton());
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/payments\//));
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(mock.db.payments.filter((p) => p.citationId === CITATION)).toHaveLength(1);
    mock.server.events.removeAllListeners();
  });

  it("explains when the citation is already paid", async () => {
    renderApp(paths.checkout(PAID_CITATION));
    await findHeading("This citation can’t be paid now");
  });

  it("explains when the link doesn't match a citation", async () => {
    renderApp(paths.checkout("00000000-0000-4000-8000-000000000000"));
    await findHeading("Citation not found");
  });
});
