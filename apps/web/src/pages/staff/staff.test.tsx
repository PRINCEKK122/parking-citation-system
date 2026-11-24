import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { serveMockApi } from "../../test/mockApi.js";
import { findHeading, renderApp } from "../../test/renderApp.js";

/** Card S1-13: staff console (F3, US3). */

const mock = serveMockApi();

async function signInAs(user: UserEvent, email: string, password: string) {
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

async function openConsole() {
  const app = renderApp("/staff");
  await findHeading("Sign in");
  await signInAs(app.user, "staff@example.com", "staff-pass-1234");
  await findHeading("Staff console");
  return app;
}

async function find(user: UserEvent, ticket: string) {
  const field = screen.getByLabelText("Ticket number");
  await user.clear(field);
  await user.type(field, ticket);
  await user.click(screen.getByRole("button", { name: "Find" }));
  // The search is a navigation; wait for its result (a citation panel, or a "no citation" note).
  await waitFor(() =>
    expect(
      screen.queryByRole("region", { name: /^T\d{8}$/ }) ?? screen.queryByText(/No citation has/),
    ).toBeTruthy(),
  );
}

const panel = () => screen.getByRole("region", { name: /^T\d{8}$/ });

describe("access (non-staff cannot reach the console)", () => {
  it("sends a guest to sign in", async () => {
    const { router } = renderApp("/staff?ticket=T00012345");
    await findHeading("Sign in");
    expect(router.state.location.search).toBe("?next=%2Fstaff%3Fticket%3DT00012345");
  });

  it("sends a resident to their own account", async () => {
    const { user, router } = renderApp("/staff");
    await findHeading("Sign in");
    await signInAs(user, "resident@example.com", "resident-pass-123");
    await waitFor(() => expect(router.state.location.pathname).toBe("/account"));
    await findHeading("Your account");
  });
});

describe("finding a citation", () => {
  it("shows an open citation's vehicle, amount and payments", async () => {
    const { user } = await openConsole();
    await find(user, "t-00012345");
    expect(within(panel()).getByText("Open")).toBeTruthy();
    expect(panel().textContent).toContain("plate ABC1234 (Missouri)");
    expect(panel().textContent).toContain("$55.00");
    expect(within(panel()).getByText("No payments yet.")).toBeTruthy();
  });

  it("says plainly when no citation has that number", async () => {
    const { user } = await openConsole();
    await find(user, "T99999999");
    expect((await screen.findByRole("status")).textContent).toContain(
      "No citation has ticket number T99999999",
    );
  });
});

describe("recording a payment", () => {
  it("records a mailed check with its reference", async () => {
    const { user } = await openConsole();
    await find(user, "T00012345");
    await user.click(within(panel()).getByLabelText("Mailed check"));
    await user.type(within(panel()).getByLabelText("Check or receipt number"), "CHK 1042");
    await user.click(within(panel()).getByRole("button", { name: "Record $55.00 payment" }));

    expect((await screen.findByText(/Mailed check payment recorded/)).textContent).toContain(
      "now paid",
    );
    await waitFor(() => expect(within(panel()).getByText("Paid")).toBeTruthy());
    expect(panel().textContent).toContain("ref CHK 1042");
    expect(within(panel()).queryByRole("button", { name: /^Record/ })).toBeNull();
  });

  it("asks for the channel and the reference", async () => {
    const { user } = await openConsole();
    await find(user, "T00012345");
    await user.click(within(panel()).getByRole("button", { name: "Record $55.00 payment" }));
    expect(await screen.findByText("Choose how the payment arrived.")).toBeTruthy();
    expect(screen.getByText("Enter the check or receipt number.")).toBeTruthy();
  });

  it("US3: a citation paid online first gets a clear 409 message and an audit row", async () => {
    const { user } = await openConsole();
    await find(user, "T00050001");
    expect(within(panel()).getByText("Open")).toBeTruthy();
    await user.click(within(panel()).getByLabelText("Mailed check"));
    await user.type(within(panel()).getByLabelText("Check or receipt number"), "CHK 2001");
    await user.click(within(panel()).getByRole("button", { name: "Record $40.00 payment" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Already paid: no payment was recorded.");
    expect(alert.textContent).toContain("Do not process this check");
    await waitFor(() => expect(within(panel()).getByText("Paid")).toBeTruthy());
    expect(panel().textContent).toContain("Online");
    expect(mock.db.audit).toEqual([
      expect.objectContaining({ action: "record_payment", outcome: "rejected_not_payable" }),
    ]);
  });
});

describe("voiding a payment", () => {
  it("needs a reason, then reopens the citation", async () => {
    const { user } = await openConsole();
    await find(user, "T00030001"); // paid online
    expect(
      within(panel()).getByText(/No payment can be recorded while this citation is paid/),
    ).toBeTruthy();

    await user.click(within(panel()).getByRole("button", { name: "Void…" }));
    await user.click(within(panel()).getByRole("button", { name: "Void this payment" }));
    expect(await screen.findByText("Say why this payment is being voided.")).toBeTruthy();

    await user.type(
      within(panel()).getByLabelText("Reason for voiding"),
      "Duplicate charge, refunded",
    );
    await user.click(within(panel()).getByRole("button", { name: "Void this payment" }));
    expect(await screen.findByText("Payment voided. The citation is open again.")).toBeTruthy();
    await waitFor(() => expect(within(panel()).getByText("Open")).toBeTruthy());
    expect(panel().textContent).toMatch(/Voided \w{3} \d/);
    expect(within(panel()).getByRole("button", { name: "Record $40.00 payment" })).toBeTruthy();
  });
});
