import { describe, expect, it } from "vitest";
import {
  apiErrorSchema,
  lookupOutcomes,
  lookupQuerySchema,
  lookupResponseSchema,
  paymentRequestSchema,
  paymentStatusSchema,
  payerSchema,
  staffPaymentRequestSchema,
  type LookupResponse,
} from "./index.js";

const CITATION_ID = "3f1c2a9e-8b4d-4c3a-9f2e-1a2b3c4d5e6f";
const PAYMENT_ID = "8d2e4b6a-1c3f-4e5d-a7b9-0c1d2e3f4a5b";

const citation = {
  id: CITATION_ID,
  ticketNo: "T00012345",
  issuedAt: "2026-11-01T14:30:00Z",
  baseCents: 4000,
  lateFeeCents: 1500,
  amountCents: 5500,
  nextIncreaseAt: "2026-12-01T00:00:00-06:00",
};

const plate = { kind: "plate", value: "ABC1234", state: "MO" } as const;

const payer = {
  name: "Jordan Lee",
  email: "jordan@example.com",
  address: { line1: "1200 Market St", city: "St. Louis", state: "MO", postalCode: "63103" },
};

describe("lookupQuerySchema", () => {
  it("trims the query and accepts an optional state", () => {
    expect(lookupQuerySchema.parse({ q: "  ABC1234 ", state: "MO" })).toEqual({
      q: "ABC1234",
      state: "MO",
    });
    expect(lookupQuerySchema.parse({ q: "T00012345" })).toEqual({ q: "T00012345" });
  });

  it("rejects an empty query and an unknown state", () => {
    expect(lookupQuerySchema.safeParse({ q: "   " }).success).toBe(false);
    expect(lookupQuerySchema.safeParse({ q: "ABC1234", state: "XX" }).success).toBe(false);
  });
});

describe("lookupResponseSchema", () => {
  const samples: Record<(typeof lookupOutcomes)[number], LookupResponse> = {
    found: { outcome: "found", identifier: plate, citations: [citation] },
    near_match: {
      outcome: "near_match",
      identifier: { kind: "vin", value: "1HGCM82633A004352" },
      suggestion: "1HGCM82633A004352",
      changedPositions: [12],
    },
    no_open_citations: { outcome: "no_open_citations", identifier: plate },
    unknown_identifier: { outcome: "unknown_identifier", identifier: plate },
    invalid_format: { outcome: "invalid_format", reason: "check_digit" },
  };

  it.each(lookupOutcomes)("accepts a valid %s response", (outcome) => {
    expect(lookupResponseSchema.parse(samples[outcome])).toEqual(samples[outcome]);
  });

  it("rejects found with no citations", () => {
    expect(lookupResponseSchema.safeParse({ ...samples.found, citations: [] }).success).toBe(false);
  });

  it("rejects a citation whose total does not equal base fine plus late fees", () => {
    const bad = { ...samples.found, citations: [{ ...citation, amountCents: 5000 }] };
    expect(lookupResponseSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a near match that sends citations or marks no changed characters", () => {
    const leaky = lookupResponseSchema.parse({ ...samples.near_match, citations: [citation] });
    expect(leaky).not.toHaveProperty("citations"); // stripped, never passed through
    expect(
      lookupResponseSchema.safeParse({ ...samples.near_match, changedPositions: [] }).success,
    ).toBe(false);
  });

  it("rejects an unknown outcome", () => {
    expect(lookupResponseSchema.safeParse({ outcome: "no_tickets_found" }).success).toBe(false);
  });
});

describe("payerSchema", () => {
  it("accepts a complete payer and a ZIP+4", () => {
    expect(payerSchema.safeParse(payer).success).toBe(true);
    const zip4 = { ...payer, address: { ...payer.address, postalCode: "63103-1234" } };
    expect(payerSchema.safeParse(zip4).success).toBe(true);
  });

  it("reports each bad field with a message the form can show", () => {
    const r = payerSchema.safeParse({
      name: " ",
      email: "jordan@",
      address: { ...payer.address, postalCode: "6310" },
    });
    expect(r.success).toBe(false);
    const paths = r.error?.issues.map((i) => i.path.join(".")).sort();
    expect(paths).toEqual(["address.postalCode", "email", "name"]);
    expect(r.error?.issues.find((i) => i.path[0] === "email")?.message).toMatch(/email address/);
  });
});

describe("paymentRequestSchema", () => {
  const body = { citationId: CITATION_ID, amountCents: 5500, payer, token: "tok_test_visa" };

  it("accepts a valid request", () => {
    expect(paymentRequestSchema.safeParse(body).success).toBe(true);
  });

  it("rejects fractional or zero amounts, a non-UUID citation and a missing token", () => {
    expect(paymentRequestSchema.safeParse({ ...body, amountCents: 55.5 }).success).toBe(false);
    expect(paymentRequestSchema.safeParse({ ...body, amountCents: 0 }).success).toBe(false);
    expect(paymentRequestSchema.safeParse({ ...body, citationId: "42" }).success).toBe(false);
    expect(paymentRequestSchema.safeParse({ ...body, token: "" }).success).toBe(false);
  });

  it("never carries a card number through to the API", () => {
    const parsed = paymentRequestSchema.parse({ ...body, cardNumber: "4242424242424242" });
    expect(parsed).not.toHaveProperty("cardNumber");
  });
});

describe("paymentStatusSchema", () => {
  it("accepts each state with its own fields", () => {
    const receipt = {
      paymentId: PAYMENT_ID,
      citationId: CITATION_ID,
      ticketNo: "T00012345",
      amountCents: 5500,
      channel: "online",
      paidAt: "2026-11-22T15:00:00Z",
    };
    for (const s of [
      { paymentId: PAYMENT_ID, citationId: CITATION_ID, state: "processing" },
      { paymentId: PAYMENT_ID, citationId: CITATION_ID, state: "succeeded", receipt },
      { paymentId: PAYMENT_ID, citationId: CITATION_ID, state: "failed", reason: "card_declined" },
    ]) {
      expect(paymentStatusSchema.safeParse(s).success).toBe(true);
    }
  });

  it("rejects succeeded without a receipt and failed without a reason", () => {
    expect(
      paymentStatusSchema.safeParse({
        paymentId: PAYMENT_ID,
        citationId: CITATION_ID,
        state: "succeeded",
      }).success,
    ).toBe(false);
    expect(
      paymentStatusSchema.safeParse({
        paymentId: PAYMENT_ID,
        citationId: CITATION_ID,
        state: "failed",
      }).success,
    ).toBe(false);
  });
});

describe("staffPaymentRequestSchema", () => {
  it("accepts a mail payment with a check number", () => {
    const r = staffPaymentRequestSchema.safeParse({
      citationId: CITATION_ID,
      channel: "mail",
      reference: " CHK 1042 ",
    });
    expect(r.success && r.data.reference).toBe("CHK 1042");
  });

  it("rejects the online channel and a blank reference", () => {
    expect(
      staffPaymentRequestSchema.safeParse({
        citationId: CITATION_ID,
        channel: "online",
        reference: "x",
      }).success,
    ).toBe(false);
    expect(
      staffPaymentRequestSchema.safeParse({
        citationId: CITATION_ID,
        channel: "mail",
        reference: "  ",
      }).success,
    ).toBe(false);
  });
});

describe("apiErrorSchema", () => {
  it("accepts a known code and rejects an unknown one", () => {
    const err = {
      error: { code: "citation_not_payable", message: "This citation is already paid." },
    };
    expect(apiErrorSchema.safeParse(err).success).toBe(true);
    expect(apiErrorSchema.safeParse({ error: { code: "oops", message: "" } }).success).toBe(false);
  });
});
