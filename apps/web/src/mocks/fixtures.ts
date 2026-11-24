import type {
  CitationStatus,
  MatchedIdentifier,
  PaymentChannel,
  PaymentState,
  UserRole,
} from "@pcs/shared";

/**
 * Synthetic records for the mock API. Each input in MOCK_INPUTS reaches one outcome, so
 * every screen can be shown and tested without a backend. The README lists the same inputs.
 */

export interface MockVehicle {
  id: string;
  identifiers: MatchedIdentifier[];
}

export interface MockCitation {
  id: string;
  ticketNo: string;
  vehicleId: string;
  issuedAt: string;
  baseCents: number;
  lateFeeCents: number;
  nextIncreaseAt: string | null;
  status: CitationStatus;
  /** Set when a late fee lands between lookup and payment, to trigger 409 amount_changed. */
  amountAtPaymentCents?: number;
}

export interface MockPayment {
  id: string;
  citationId: string;
  amountCents: number;
  channel: PaymentChannel;
  state: PaymentState;
  createdAt: string;
  /** Outcome the gateway will report, taken from the card token. */
  outcome?: "succeeds" | "declined" | "gateway_error" | "slow";
  polls: number;
  userId?: string;
  reference?: string;
  paidAt?: string;
  voidedAt?: string;
}

export interface MockUser {
  id: string;
  email: string;
  password: string;
  role: UserRole;
}

export const VEHICLES: MockVehicle[] = [
  {
    id: "0b6f6a52-1f6e-4c1e-9a43-000000000001",
    identifiers: [{ kind: "plate", value: "ABC1234", state: "MO" }],
  },
  {
    id: "0b6f6a52-1f6e-4c1e-9a43-000000000002",
    identifiers: [{ kind: "vin", value: "1HGCM82633A004352" }],
  },
  {
    id: "0b6f6a52-1f6e-4c1e-9a43-000000000003",
    identifiers: [{ kind: "plate", value: "XYZ789", state: "IL" }],
  },
  {
    id: "0b6f6a52-1f6e-4c1e-9a43-000000000004",
    identifiers: [{ kind: "vin", value: "1M8GDM9AXKP042788" }],
  },
  {
    id: "0b6f6a52-1f6e-4c1e-9a43-000000000005",
    identifiers: [{ kind: "plate", value: "FEE2026", state: "MO" }],
  },
];

export const CITATIONS: MockCitation[] = [
  {
    id: "5c0d7e1a-3b2f-4d6a-8e90-000000000001",
    ticketNo: "T00012345",
    vehicleId: VEHICLES[0]!.id,
    issuedAt: "2026-10-02T15:20:00Z",
    baseCents: 4000,
    lateFeeCents: 1500,
    nextIncreaseAt: "2026-12-02T06:00:00Z",
    status: "open",
  },
  {
    id: "5c0d7e1a-3b2f-4d6a-8e90-000000000002",
    ticketNo: "T00012346",
    vehicleId: VEHICLES[0]!.id,
    issuedAt: "2026-11-10T13:05:00Z",
    baseCents: 2500,
    lateFeeCents: 0,
    nextIncreaseAt: "2026-12-10T06:00:00Z",
    status: "open",
  },
  {
    id: "5c0d7e1a-3b2f-4d6a-8e90-000000000003",
    ticketNo: "T00020001",
    vehicleId: VEHICLES[1]!.id,
    issuedAt: "2026-11-15T18:40:00Z",
    baseCents: 7500,
    lateFeeCents: 0,
    nextIncreaseAt: "2026-12-15T06:00:00Z",
    status: "open",
  },
  {
    id: "5c0d7e1a-3b2f-4d6a-8e90-000000000004",
    ticketNo: "T00030001",
    vehicleId: VEHICLES[2]!.id,
    issuedAt: "2026-09-21T16:00:00Z",
    baseCents: 4000,
    lateFeeCents: 0,
    nextIncreaseAt: null,
    status: "paid",
  },
  {
    id: "5c0d7e1a-3b2f-4d6a-8e90-000000000005",
    ticketNo: "T00040001",
    vehicleId: VEHICLES[4]!.id,
    issuedAt: "2026-10-22T14:10:00Z",
    baseCents: 2500,
    lateFeeCents: 0,
    nextIncreaseAt: "2026-12-01T06:00:00Z",
    status: "open",
    amountAtPaymentCents: 3500,
  },
];

export const USERS: MockUser[] = [
  {
    id: "9e4a1c2b-7d3f-4b5e-a6c8-000000000001",
    email: "resident@example.com",
    password: "resident-pass-123",
    role: "resident",
  },
  {
    id: "9e4a1c2b-7d3f-4b5e-a6c8-000000000002",
    email: "staff@example.com",
    password: "staff-pass-1234",
    role: "staff",
  },
];

/** The resident already paid T00030001 online, so their history is not empty. */
export const PAYMENTS: MockPayment[] = [
  {
    id: "7f3b9d2e-4a1c-4e8f-b2d6-000000000001",
    citationId: CITATIONS[3]!.id,
    amountCents: 4000,
    channel: "online",
    state: "succeeded",
    createdAt: "2026-10-01T20:15:00Z",
    paidAt: "2026-10-01T20:15:04Z",
    polls: 0,
    userId: USERS[0]!.id,
  },
];

export const SAVED_VEHICLES = [
  {
    id: "2d8c4f6a-9b1e-4a3d-8c5f-000000000001",
    userId: USERS[0]!.id,
    nickname: "My car",
    identifier: { kind: "plate", value: "ABC1234", state: "MO" } as MatchedIdentifier,
  },
];

/** Inputs that reach each outcome. Shown in the README and used by the mock tests. */
export const MOCK_INPUTS = {
  found: [
    { q: "ABC1234", state: "MO", note: "2 open citations" },
    { q: "1HGCM82633A004352", note: "VIN, 1 open citation" },
    { q: "T00012345", note: "ticket number" },
  ],
  near_match: [{ q: "A8C1234", state: "MO", note: "8 typed for B; suggests ABC1234" }],
  no_open_citations: [
    { q: "XYZ789", state: "IL", note: "only citation already paid" },
    { q: "1M8GDM9AXKP042788", note: "VIN with no citations" },
  ],
  unknown_identifier: [{ q: "QQQ999", state: "MO", note: "any valid input not on file" }],
  invalid_format: [
    { q: "1HGCM82643A004352", note: "check_digit" },
    { q: "1HGCM82633A00435", note: "length (16-character VIN)" },
    { q: "ABC1234", note: "missing_state" },
  ],
  errors: [
    { q: "RATELIM", state: "MO", note: "429 rate_limited" },
    { q: "ERROR500", state: "MO", note: "500 internal" },
  ],
  amount_changed: [{ q: "FEE2026", state: "MO", note: "late fee lands before payment: 409" }],
} as const;

/** Gateway polls before a payment reaches its final state. */
export const POLLS_TO_SETTLE = { succeeds: 2, declined: 2, gateway_error: 2, slow: 6 } as const;
