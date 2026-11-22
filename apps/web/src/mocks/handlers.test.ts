import { describe, expect, it } from "vitest";
import type { PaymentRequest, PaymentStatus, StateCode } from "@pcs/shared";
import * as api from "../api/client.js";
import { MOCK_INPUTS, POLLS_TO_SETTLE } from "./fixtures.js";
import { serveMockApi } from "../test/mockApi.js";

/**
 * Drives the mock API through the real client, so every mocked response is also checked
 * against the shared schemas. If a handler drifts from the contract, these tests fail.
 */

const mock = serveMockApi();

const payer: PaymentRequest["payer"] = {
  name: "Jordan Lee",
  email: "jordan@example.com",
  address: { line1: "1200 Market St", city: "St. Louis", state: "MO", postalCode: "63103" },
};
const card = (number: string) => ({ number, expMonth: 12, expYear: 2030, cvc: "123" });

async function firstOpenCitation(q = "ABC1234", state: StateCode = "MO") {
  const r = await api.lookup({ q, state });
  if (r.outcome !== "found") throw new Error(`expected found, got ${r.outcome}`);
  return r.citations[0]!;
}

async function pay(cardNumber: string, key: string = crypto.randomUUID()) {
  const citation = await firstOpenCitation();
  const token = await api.tokenizeCard(card(cardNumber));
  const accepted = await api.createPayment(
    { citationId: citation.id, amountCents: citation.amountCents, payer, token },
    key,
  );
  return { citation, accepted };
}

async function pollUntilDone(
  paymentId: string,
  max = 10,
): Promise<{ final: PaymentStatus; polls: number }> {
  for (let polls = 1; polls <= max; polls++) {
    const s = await api.getPayment(paymentId);
    if (s.state === "succeeded" || s.state === "failed") return { final: s, polls };
  }
  throw new Error("payment never settled");
}

describe("lookup: every outcome is reachable from a fixture input", () => {
  const cases = (
    ["found", "near_match", "no_open_citations", "unknown_identifier", "invalid_format"] as const
  ).flatMap((outcome) => MOCK_INPUTS[outcome].map((input) => ({ outcome, input })));

  it.each(cases)("$input.q $input.state -> $outcome ($input.note)", async ({ outcome, input }) => {
    const r = await api.lookup({ q: input.q, state: "state" in input ? input.state : undefined });
    expect(r.outcome).toBe(outcome);
  });

  it("returns both citations with correct totals for ABC1234 (S1-09 fixture)", async () => {
    const r = await api.lookup({ q: "abc 1234", state: "MO" });
    expect(r.outcome === "found" && r.citations.map((c) => [c.ticketNo, c.amountCents])).toEqual([
      ["T00012345", 5500],
      ["T00012346", 2500],
    ]);
  });

  it("points at the corrected character in a near match", async () => {
    const r = await api.lookup({ q: "A8C1234", state: "MO" });
    expect(r).toMatchObject({
      outcome: "near_match",
      suggestion: "ABC1234",
      changedPositions: [1],
    });
    expect(r).not.toHaveProperty("citations");
  });

  it("gives the format reason with invalid_format", async () => {
    expect(await api.lookup({ q: "1HGCM82633A00435" })).toEqual({
      outcome: "invalid_format",
      reason: "length",
    });
  });

  it.each([
    ["RATELIM", 429, "rate_limited"],
    ["ERROR500", 500, "internal"],
  ])("%s triggers HTTP %i %s", async (q, status, code) => {
    await expect(api.lookup({ q, state: "MO" })).rejects.toMatchObject({ status, code });
  });
});

describe("payments", () => {
  it("succeeds after polling, then the citation is no longer open", async () => {
    const { citation, accepted } = await pay("4242424242424242");
    expect(accepted.state).toBe("processing");
    const { final, polls } = await pollUntilDone(accepted.paymentId);
    expect(polls).toBe(POLLS_TO_SETTLE.succeeds);
    expect(final).toMatchObject({
      state: "succeeded",
      receipt: { ticketNo: citation.ticketNo, amountCents: 5500 },
    });
    const after = await api.lookup({ q: "ABC1234", state: "MO" });
    expect(after.outcome === "found" && after.citations.map((c) => c.id)).not.toContain(
      citation.id,
    );
  });

  it.each([
    ["4000000000000002", "card_declined"],
    ["4000000000000119", "gateway_error"],
  ])("card %s ends failed with %s and the citation can be paid again", async (number, reason) => {
    const { accepted } = await pay(number);
    expect((await pollUntilDone(accepted.paymentId)).final).toMatchObject({
      state: "failed",
      reason,
    });
    const retry = await pay("4242424242424242");
    expect(retry.accepted.state).toBe("processing");
  });

  it("keeps a slow payment processing for several polls before it succeeds", async () => {
    const { accepted } = await pay("4000000000000077");
    const { final, polls } = await pollUntilDone(accepted.paymentId);
    expect(final.state).toBe("succeeded");
    expect(polls).toBe(POLLS_TO_SETTLE.slow);
  });

  it("replays the same response for the same key and body, even when sent 10 times at once", async () => {
    const citation = await firstOpenCitation();
    const token = await api.tokenizeCard(card("4242424242424242"));
    const body = { citationId: citation.id, amountCents: citation.amountCents, payer, token };
    const key = crypto.randomUUID();
    const responses = await Promise.all(
      Array.from({ length: 10 }, () => api.createPayment(body, key)),
    );
    expect(new Set(responses.map((r) => r.paymentId)).size).toBe(1);
    expect(mock.db.payments.filter((p) => p.citationId === citation.id)).toHaveLength(1);
  });

  it("rejects a reused key with a different body (422)", async () => {
    const key = crypto.randomUUID();
    const { citation } = await pay("4242424242424242", key);
    const token = await api.tokenizeCard(card("4242424242424242"));
    await expect(
      api.createPayment({ citationId: citation.id, amountCents: 1, payer, token }, key),
    ).rejects.toMatchObject({ status: 422, code: "idempotency_key_reused" });
  });

  it("refuses a second payment while the first is active (409 citation_not_payable)", async () => {
    await pay("4242424242424242");
    await expect(pay("4242424242424242")).rejects.toMatchObject({
      status: 409,
      code: "citation_not_payable",
    });
  });

  it("reports a late fee that landed after lookup (409 amount_changed), then shows the new total", async () => {
    const citation = await firstOpenCitation("FEE2026");
    const token = await api.tokenizeCard(card("4242424242424242"));
    await expect(
      api.createPayment(
        { citationId: citation.id, amountCents: citation.amountCents, payer, token },
        crypto.randomUUID(),
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "amount_changed",
      details: { amountCents: 3500 },
    });
    expect((await firstOpenCitation("FEE2026")).amountCents).toBe(3500);
  });

  it("returns 404 for an unknown payment id", async () => {
    await expect(api.getPayment(crypto.randomUUID())).rejects.toMatchObject({
      status: 404,
      code: "not_found",
    });
  });
});

describe("gateway tokens", () => {
  it("refuses cards that are not test cards, and expired cards", async () => {
    await expect(api.tokenizeCard(card("4111111111111111"))).rejects.toMatchObject({
      reason: "invalid_card",
    });
    await expect(
      api.tokenizeCard({ ...card("4242424242424242"), expYear: 2020 }),
    ).rejects.toMatchObject({
      reason: "expired_card",
    });
  });
});

describe("auth and resident account", () => {
  it("is a guest until sign-in, and rejects a wrong password", async () => {
    expect(await api.getSession()).toBeNull();
    await expect(
      api.signIn({ email: "resident@example.com", password: "nope" }),
    ).rejects.toMatchObject({
      status: 401,
    });
  });

  it("lets a resident see saved vehicles and history, add a vehicle, and sign out", async () => {
    const { user } = await api.signIn({
      email: "resident@example.com",
      password: "resident-pass-123",
    });
    expect(user.role).toBe("resident");
    expect((await api.listVehicles()).map((v) => v.nickname)).toEqual(["My car"]);
    expect((await api.listMyPayments())[0]).toMatchObject({
      ticketNo: "T00030001",
      state: "succeeded",
    });
    await api.addVehicle({
      nickname: "Work truck",
      identifier: { kind: "vin", value: "1HGCM82633A004352" },
    });
    expect(await api.listVehicles()).toHaveLength(2);
    await api.signOut();
    await expect(api.listVehicles()).rejects.toMatchObject({ status: 401 });
  });

  it("registers a new resident and refuses a duplicate email", async () => {
    const { user } = await api.register({ email: "new@example.com", password: "a-long-password" });
    expect(user.role).toBe("resident");
    await expect(
      api.register({ email: "resident@example.com", password: "a-long-password" }),
    ).rejects.toMatchObject({
      status: 409,
      code: "email_taken",
    });
  });
});

describe("staff routes", () => {
  it("are closed to guests (401) and residents (403)", async () => {
    await expect(api.findCitationForStaff("T00012345")).rejects.toMatchObject({ status: 401 });
    await api.signIn({ email: "resident@example.com", password: "resident-pass-123" });
    await expect(api.findCitationForStaff("T00012345")).rejects.toMatchObject({
      status: 403,
      code: "forbidden",
    });
  });

  it("refuse a mail payment for a citation already paid online, and audit it (US3)", async () => {
    await api.signIn({ email: "staff@example.com", password: "staff-pass-1234" });
    const c = await api.findCitationForStaff("T00030001");
    expect(c.status).toBe("paid");
    await expect(
      api.recordStaffPayment({ citationId: c.id, channel: "mail", reference: "CHK 1042" }),
    ).rejects.toMatchObject({ status: 409, code: "citation_not_payable" });
    expect(mock.db.audit).toEqual([
      expect.objectContaining({ citationId: c.id, outcome: "rejected_not_payable" }),
    ]);
  });

  it("record a walk-in payment, then void it so the citation is open again", async () => {
    await api.signIn({ email: "staff@example.com", password: "staff-pass-1234" });
    const c = await api.findCitationForStaff("t-00012346");
    const rec = await api.recordStaffPayment({
      citationId: c.id,
      channel: "walk_in",
      reference: "R-77",
    });
    expect(rec.state).toBe("succeeded");
    expect((await api.findCitationForStaff("T00012346")).status).toBe("paid");
    expect(await api.voidPayment(rec.paymentId, { reason: "Entered on wrong citation" })).toEqual({
      paymentId: rec.paymentId,
      citationStatus: "open",
    });
    await expect(api.voidPayment(rec.paymentId, { reason: "again" })).rejects.toMatchObject({
      code: "payment_not_voidable",
    });
  });
});
