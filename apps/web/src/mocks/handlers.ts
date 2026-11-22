import { delay, http, HttpResponse } from "msw";
import {
  IDEMPOTENCY_KEY_HEADER,
  TEST_CARDS,
  classifyIdentifier,
  idempotencyKeySchema,
  lookupQuerySchema,
  newSavedVehicleSchema,
  paymentRequestSchema,
  registerRequestSchema,
  signInRequestSchema,
  staffPaymentRequestSchema,
  tokenizeRequestSchema,
  voidPaymentRequestSchema,
  type ApiError,
  type ApiErrorCode,
  type CitationSummary,
  type LookupResponse,
  type MatchedIdentifier,
  type PaymentStatus,
  type SavedVehicle,
  type SessionUser,
  type StaffCitation,
} from "@pcs/shared";
import {
  CITATIONS,
  PAYMENTS,
  POLLS_TO_SETTLE,
  SAVED_VEHICLES,
  USERS,
  VEHICLES,
  type MockCitation,
  type MockPayment,
} from "./fixtures.js";

/**
 * In-memory stand-in for the API and the gateway, following the midterm API table.
 * createMockApi() returns fresh state, so each test starts clean; the browser keeps one.
 */

/** Plate characters people confuse: both sides map to the same canonical character. */
const CONFUSABLE: Record<string, string> = { O: "0", I: "1", S: "5", B: "8", Z: "2" };
const canonical = (s: string) => s.replace(/[OISBZ]/g, (c) => CONFUSABLE[c] ?? c);

interface SessionStore {
  get(): string | null;
  set(userId: string | null): void;
}

const memorySession = (): SessionStore => {
  let id: string | null = null;
  return { get: () => id, set: (v) => (id = v) };
};

export interface MockApiOptions {
  gatewayUrl: string;
  /** Where the signed-in user id lives; the browser passes sessionStorage so a reload keeps it. */
  session?: SessionStore;
}

export function createMockApi({ gatewayUrl, session = memorySession() }: MockApiOptions) {
  const db = {
    citations: structuredClone(CITATIONS),
    payments: structuredClone(PAYMENTS),
    users: structuredClone(USERS),
    savedVehicles: structuredClone(SAVED_VEHICLES),
    /** Idempotency-Key -> stored request and response. */
    idempotency: new Map<string, { body: string; status: number; response: unknown }>(),
    /** Staff actions, as the real API writes audit rows (F3, US3). */
    audit: [] as Array<{
      at: string;
      userId: string;
      action: string;
      citationId: string;
      outcome: string;
    }>,
  };

  const now = () => new Date().toISOString();

  const fail = (status: number, code: ApiErrorCode, message: string, details?: unknown) =>
    HttpResponse.json<ApiError>(
      { error: { code, message, ...(details ? { details } : {}) } },
      { status },
    );

  const currentUser = (): SessionUser | null => {
    const id = session.get();
    const u = db.users.find((x) => x.id === id);
    return u ? { id: u.id, email: u.email, role: u.role } : null;
  };

  /** Returns the user, or a 401/403 response to send instead. */
  const requireRole = (role: SessionUser["role"]) => {
    const user = currentUser();
    if (!user) return fail(401, "unauthorized", "Sign in to continue.");
    if (user.role !== role) return fail(403, "forbidden", "You don't have access to this page.");
    return user;
  };

  const payableCents = (c: MockCitation) => c.baseCents + c.lateFeeCents;

  /** Drop the owner id before a saved vehicle leaves the "server". */
  const toSavedVehicle = (v: (typeof db.savedVehicles)[number]): SavedVehicle => ({
    id: v.id,
    nickname: v.nickname,
    identifier: v.identifier,
  });

  const summary = (c: MockCitation): CitationSummary => ({
    id: c.id,
    ticketNo: c.ticketNo,
    issuedAt: c.issuedAt,
    baseCents: c.baseCents,
    lateFeeCents: c.lateFeeCents,
    amountCents: payableCents(c),
    nextIncreaseAt: c.nextIncreaseAt,
  });

  const vehicleIdentifier = (vehicleId: string): MatchedIdentifier =>
    VEHICLES.find((v) => v.id === vehicleId)!.identifiers[0]!;

  const hasActivePayment = (citationId: string) =>
    db.payments.some(
      (p) =>
        p.citationId === citationId &&
        !p.voidedAt &&
        (p.state === "processing" || p.state === "succeeded"),
    );

  const isPayable = (c: MockCitation) => c.status === "open" && !hasActivePayment(c.id);

  const openFor = (vehicleId: string) =>
    db.citations.filter((c) => c.vehicleId === vehicleId && c.status === "open").map(summary);

  function findVehicle(id: MatchedIdentifier) {
    return VEHICLES.find((v) =>
      v.identifiers.some((x) => x.kind === id.kind && x.value === id.value && x.state === id.state),
    );
  }

  /** A unique vehicle whose identifier differs from the input only by confusable characters. */
  function nearMatch(id: MatchedIdentifier) {
    if (id.kind !== "plate") return null;
    const hits = VEHICLES.flatMap((v) => v.identifiers).filter(
      (x) =>
        x.kind === "plate" &&
        x.state === id.state &&
        x.value.length === id.value.length &&
        canonical(x.value) === canonical(id.value),
    );
    if (hits.length !== 1) return null;
    const suggestion = hits[0]!.value;
    const changedPositions = [...suggestion].flatMap((ch, i) => (ch !== id.value[i] ? [i] : []));
    return { suggestion, changedPositions };
  }

  function lookup(
    q: string,
    state: string | undefined,
  ): { status: number; body: LookupResponse } | Response {
    const parsed = lookupQuerySchema.safeParse({ q, state: state || undefined });
    if (!parsed.success)
      return fail(400, "validation_failed", "Enter something to search for.", parsed.error.issues);

    const id = classifyIdentifier(parsed.data.q, parsed.data.state);
    if (!id.ok) return { status: 422, body: { outcome: "invalid_format", reason: id.reason } };

    // Fault triggers for exercising error screens.
    if (id.kind === "plate" && id.value === "RATELIM") {
      return fail(429, "rate_limited", "Too many searches. Wait a minute and try again.");
    }
    if (id.kind === "plate" && id.value === "ERROR500")
      return fail(500, "internal", "Something went wrong.");

    const identifier: MatchedIdentifier =
      id.kind === "plate"
        ? { kind: "plate", value: id.value, state: id.state }
        : { kind: id.kind, value: id.value };

    if (id.kind === "ticket") {
      const c = db.citations.find((x) => x.ticketNo === id.value);
      if (!c) return { status: 200, body: { outcome: "unknown_identifier", identifier } };
      return c.status === "open"
        ? { status: 200, body: { outcome: "found", identifier, citations: [summary(c)] } }
        : { status: 200, body: { outcome: "no_open_citations", identifier } };
    }

    const vehicle = findVehicle(identifier);
    if (vehicle) {
      const citations = openFor(vehicle.id);
      return citations.length
        ? { status: 200, body: { outcome: "found", identifier, citations } }
        : { status: 200, body: { outcome: "no_open_citations", identifier } };
    }

    const near = nearMatch(identifier);
    if (near) return { status: 200, body: { outcome: "near_match", identifier, ...near } };
    return { status: 200, body: { outcome: "unknown_identifier", identifier } };
  }

  function status(p: MockPayment): PaymentStatus {
    if (p.state === "succeeded") {
      const c = db.citations.find((x) => x.id === p.citationId)!;
      return {
        paymentId: p.id,
        state: "succeeded",
        receipt: {
          paymentId: p.id,
          citationId: c.id,
          ticketNo: c.ticketNo,
          amountCents: p.amountCents,
          channel: p.channel,
          paidAt: p.paidAt!,
        },
      };
    }
    if (p.state === "failed") {
      return {
        paymentId: p.id,
        state: "failed",
        reason: p.outcome === "declined" ? "card_declined" : "gateway_error",
      };
    }
    return { paymentId: p.id, state: p.state === "created" ? "created" : "processing" };
  }

  /** Each poll stands in for time passing at the gateway. */
  function advance(p: MockPayment) {
    if (p.state !== "processing" || !p.outcome) return;
    p.polls += 1;
    if (p.polls < POLLS_TO_SETTLE[p.outcome]) return;
    if (p.outcome === "succeeds" || p.outcome === "slow") {
      p.state = "succeeded";
      p.paidAt = now();
      db.citations.find((c) => c.id === p.citationId)!.status = "paid";
    } else {
      p.state = "failed";
    }
  }

  const handlers = [
    // ---------- Gateway ----------
    http.post(`${gatewayUrl}/v1/tokens`, async ({ request }) => {
      await delay();
      const body = tokenizeRequestSchema.safeParse(await request.json().catch(() => null));
      if (!body.success) return HttpResponse.json({ error: "invalid_card" }, { status: 400 });
      const card = TEST_CARDS.find((c) => c.number === body.data.number);
      if (!card) return HttpResponse.json({ error: "invalid_card" }, { status: 400 });
      const today = new Date();
      const expired =
        body.data.expYear < today.getFullYear() ||
        (body.data.expYear === today.getFullYear() && body.data.expMonth < today.getMonth() + 1);
      if (expired) return HttpResponse.json({ error: "expired_card" }, { status: 400 });
      return HttpResponse.json({ token: `tok_${card.outcome}_${crypto.randomUUID().slice(0, 8)}` });
    }),

    // ---------- Lookup ----------
    http.get("/api/lookup", async ({ request }) => {
      await delay();
      const url = new URL(request.url);
      const result = lookup(
        url.searchParams.get("q") ?? "",
        url.searchParams.get("state") ?? undefined,
      );
      return result instanceof Response
        ? result
        : HttpResponse.json(result.body, { status: result.status });
    }),

    // ---------- Payments ----------
    http.post("/api/payments", async ({ request }) => {
      await delay();
      const key = idempotencyKeySchema.safeParse(request.headers.get(IDEMPOTENCY_KEY_HEADER));
      if (!key.success)
        return fail(
          400,
          "validation_failed",
          `Send a UUID in the ${IDEMPOTENCY_KEY_HEADER} header.`,
        );

      const parsed = paymentRequestSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success)
        return fail(400, "validation_failed", "Check the payment details.", parsed.error.issues);
      const body = parsed.data;
      const bodyKey = JSON.stringify(body);

      const seen = db.idempotency.get(key.data);
      if (seen) {
        if (seen.body !== bodyKey) {
          return fail(
            422,
            "idempotency_key_reused",
            "This payment key was already used for a different payment.",
          );
        }
        return HttpResponse.json(seen.response as object, { status: seen.status });
      }

      const citation = db.citations.find((c) => c.id === body.citationId);
      if (!citation) return fail(404, "not_found", "No such citation.");
      if (!isPayable(citation))
        return fail(409, "citation_not_payable", "This citation is already paid.");

      const current = citation.amountAtPaymentCents ?? payableCents(citation);
      if (body.amountCents !== current) {
        // The fee has now landed; later lookups show the new amount.
        citation.lateFeeCents = current - citation.baseCents;
        delete citation.amountAtPaymentCents;
        return fail(409, "amount_changed", "The amount due changed. Review the new total.", {
          amountCents: current,
        });
      }

      const outcome = /^tok_(succeeds|declined|gateway_error|slow)_/.exec(
        body.token,
      )?.[1] as MockPayment["outcome"];
      if (!outcome) return fail(400, "validation_failed", "The card token is not valid.");

      const payment: MockPayment = {
        id: crypto.randomUUID(),
        citationId: citation.id,
        amountCents: body.amountCents,
        channel: "online",
        state: "processing",
        createdAt: now(),
        outcome,
        polls: 0,
        userId: currentUser()?.id,
      };
      db.payments.push(payment);
      const response = { paymentId: payment.id, state: "processing" as const };
      db.idempotency.set(key.data, { body: bodyKey, status: 202, response });
      return HttpResponse.json(response, { status: 202 });
    }),

    http.get("/api/payments/:id", async ({ params }) => {
      await delay();
      const p = db.payments.find((x) => x.id === params.id);
      if (!p) return fail(404, "not_found", "No such payment.");
      advance(p);
      return HttpResponse.json(status(p));
    }),

    // ---------- Auth ----------
    http.post("/api/auth/sign-in", async ({ request }) => {
      await delay();
      const body = signInRequestSchema.safeParse(await request.json().catch(() => null));
      if (!body.success)
        return fail(400, "validation_failed", "Enter your email and password.", body.error.issues);
      const u = db.users.find(
        (x) => x.email === body.data.email.toLowerCase() && x.password === body.data.password,
      );
      if (!u) return fail(401, "unauthorized", "That email and password don't match an account.");
      session.set(u.id);
      return HttpResponse.json({ user: currentUser() });
    }),

    http.post("/api/auth/register", async ({ request }) => {
      await delay();
      const body = registerRequestSchema.safeParse(await request.json().catch(() => null));
      if (!body.success)
        return fail(400, "validation_failed", "Check the highlighted fields.", body.error.issues);
      const email = body.data.email.toLowerCase();
      if (db.users.some((x) => x.email === email)) {
        return fail(
          409,
          "email_taken",
          "An account with this email already exists. Sign in instead.",
        );
      }
      const u = {
        id: crypto.randomUUID(),
        email,
        password: body.data.password,
        role: "resident" as const,
      };
      db.users.push(u);
      session.set(u.id);
      return HttpResponse.json({ user: currentUser() }, { status: 201 });
    }),

    http.post("/api/auth/sign-out", () => {
      session.set(null);
      return new HttpResponse(null, { status: 204 });
    }),

    http.get("/api/auth/me", () => {
      const user = currentUser();
      return user ? HttpResponse.json({ user }) : fail(401, "unauthorized", "Not signed in.");
    }),

    // ---------- Resident account ----------
    http.get("/api/me/vehicles", async () => {
      await delay();
      const user = requireRole("resident");
      if (user instanceof Response) return user;
      return HttpResponse.json(
        db.savedVehicles.filter((v) => v.userId === user.id).map(toSavedVehicle),
      );
    }),

    http.post("/api/me/vehicles", async ({ request }) => {
      await delay();
      const user = requireRole("resident");
      if (user instanceof Response) return user;
      const body = newSavedVehicleSchema.safeParse(await request.json().catch(() => null));
      if (!body.success)
        return fail(400, "validation_failed", "Check the vehicle details.", body.error.issues);
      const v = { id: crypto.randomUUID(), userId: user.id, ...body.data };
      db.savedVehicles.push(v);
      return HttpResponse.json(toSavedVehicle(v), { status: 201 });
    }),

    http.get("/api/me/payments", async () => {
      await delay();
      const user = requireRole("resident");
      if (user instanceof Response) return user;
      return HttpResponse.json(
        db.payments
          .filter((p) => p.userId === user.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((p) => ({
            paymentId: p.id,
            ticketNo: db.citations.find((c) => c.id === p.citationId)!.ticketNo,
            amountCents: p.amountCents,
            state: p.state,
            createdAt: p.createdAt,
          })),
      );
    }),

    // ---------- Staff ----------
    http.get("/api/staff/citations", async ({ request }) => {
      await delay();
      const user = requireRole("staff");
      if (user instanceof Response) return user;
      const ticketNo = (new URL(request.url).searchParams.get("ticketNo") ?? "")
        .toUpperCase()
        .replace(/[\s-]/g, "");
      const c = db.citations.find((x) => x.ticketNo === ticketNo);
      if (!c) return fail(404, "not_found", `No citation ${ticketNo || "with that number"}.`);
      const out: StaffCitation = {
        id: c.id,
        ticketNo: c.ticketNo,
        status: c.status,
        issuedAt: c.issuedAt,
        amountCents: payableCents(c),
        vehicle: vehicleIdentifier(c.vehicleId),
        payments: db.payments
          .filter((p) => p.citationId === c.id)
          .map((p) => ({
            paymentId: p.id,
            channel: p.channel,
            state: p.state,
            amountCents: p.amountCents,
            createdAt: p.createdAt,
            ...(p.reference ? { reference: p.reference } : {}),
            ...(p.voidedAt ? { voidedAt: p.voidedAt } : {}),
          })),
      };
      return HttpResponse.json(out);
    }),

    http.post("/api/staff/payments", async ({ request }) => {
      await delay();
      const user = requireRole("staff");
      if (user instanceof Response) return user;
      const body = staffPaymentRequestSchema.safeParse(await request.json().catch(() => null));
      if (!body.success)
        return fail(400, "validation_failed", "Check the payment details.", body.error.issues);
      const c = db.citations.find((x) => x.id === body.data.citationId);
      if (!c) return fail(404, "not_found", "No such citation.");
      if (!isPayable(c)) {
        db.audit.push({
          at: now(),
          userId: user.id,
          action: "record_payment",
          citationId: c.id,
          outcome: "rejected_not_payable",
        });
        return fail(
          409,
          "citation_not_payable",
          "This citation is already paid. No payment was recorded.",
        );
      }
      const p: MockPayment = {
        id: crypto.randomUUID(),
        citationId: c.id,
        amountCents: payableCents(c),
        channel: body.data.channel,
        state: "succeeded",
        createdAt: now(),
        paidAt: now(),
        polls: 0,
        reference: body.data.reference,
      };
      db.payments.push(p);
      c.status = "paid";
      db.audit.push({
        at: now(),
        userId: user.id,
        action: "record_payment",
        citationId: c.id,
        outcome: "recorded",
      });
      return HttpResponse.json({ paymentId: p.id, state: "succeeded" }, { status: 201 });
    }),

    http.post("/api/staff/payments/:id/void", async ({ params, request }) => {
      await delay();
      const user = requireRole("staff");
      if (user instanceof Response) return user;
      const body = voidPaymentRequestSchema.safeParse(await request.json().catch(() => null));
      if (!body.success)
        return fail(400, "validation_failed", "Give a reason for the void.", body.error.issues);
      const p = db.payments.find((x) => x.id === params.id);
      if (!p) return fail(404, "not_found", "No such payment.");
      if (p.state !== "succeeded" || p.voidedAt) {
        return fail(
          409,
          "payment_not_voidable",
          "Only a successful payment that is not already voided can be voided.",
        );
      }
      p.voidedAt = now();
      db.citations.find((c) => c.id === p.citationId)!.status = "open";
      db.audit.push({
        at: now(),
        userId: user.id,
        action: "void_payment",
        citationId: p.citationId,
        outcome: "voided",
      });
      return HttpResponse.json({ paymentId: p.id, citationStatus: "open" });
    }),
  ];

  return { handlers, db };
}
