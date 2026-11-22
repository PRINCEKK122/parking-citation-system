import type { z } from "zod";
import {
  IDEMPOTENCY_KEY_HEADER,
  apiErrorSchema,
  lookupResponseSchema,
  paymentAcceptedSchema,
  paymentHistoryItemSchema,
  paymentStatusSchema,
  savedVehicleSchema,
  sessionResponseSchema,
  staffCitationSchema,
  staffPaymentResponseSchema,
  tokenizeErrorSchema,
  tokenizeResponseSchema,
  voidPaymentResponseSchema,
  type ApiErrorCode,
  type LookupQuery,
  type NewSavedVehicle,
  type PaymentRequest,
  type RegisterRequest,
  type SignInRequest,
  type StaffPaymentRequest,
  type TokenizeRequest,
  type VoidPaymentRequest,
} from "@pcs/shared";
import { config } from "../config.js";

/**
 * Typed calls to the API and the gateway. Every response is checked against the shared
 * schema, so a mock or server that drifts from the contract fails loudly here.
 */

export type ClientErrorCode = ApiErrorCode | "network_error" | "bad_response";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: ClientErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  /** Non-2xx statuses whose body is a normal response, e.g. 422 from lookup. */
  alsoOk?: number[];
}

/** Resolve against the page origin; Node's fetch (used in tests) rejects relative URLs. */
function apiUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}

async function send(url: string, opts: RequestOptions): Promise<Response> {
  try {
    return await fetch(url, {
      method: opts.method ?? "GET",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...opts.headers,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiRequestError(
      0,
      "network_error",
      "Could not reach the server. Check your connection.",
    );
  }
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

async function request<S extends z.ZodType>(
  path: string,
  schema: S,
  opts: RequestOptions = {},
): Promise<z.infer<S>> {
  const res = await send(apiUrl(path), opts);
  const json = await readJson(res);

  if (!res.ok && !opts.alsoOk?.includes(res.status)) {
    const err = apiErrorSchema.safeParse(json);
    if (err.success) {
      const { code, message, details } = err.data.error;
      throw new ApiRequestError(res.status, code, message, details);
    }
    throw new ApiRequestError(res.status, "bad_response", `Unexpected ${res.status} response.`);
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiRequestError(
      res.status,
      "bad_response",
      "The server sent an unexpected response.",
      parsed.error.issues,
    );
  }
  return parsed.data;
}

// ---------- Lookup ----------

export function lookup(query: LookupQuery) {
  const params = new URLSearchParams({
    q: query.q,
    ...(query.state ? { state: query.state } : {}),
  });
  return request(`/api/lookup?${params.toString()}`, lookupResponseSchema, { alsoOk: [422] });
}

// ---------- Payments ----------

export function createPayment(body: PaymentRequest, idempotencyKey: string) {
  return request("/api/payments", paymentAcceptedSchema, {
    method: "POST",
    body,
    headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
  });
}

export function getPayment(paymentId: string) {
  return request(`/api/payments/${encodeURIComponent(paymentId)}`, paymentStatusSchema);
}

/** Send the card to the gateway, never to our API. Throws `invalid_card` or `expired_card`. */
export async function tokenizeCard(card: TokenizeRequest): Promise<string> {
  const res = await send(`${config.gatewayUrl}/v1/tokens`, { method: "POST", body: card });
  const json = await readJson(res);
  if (res.ok) {
    const ok = tokenizeResponseSchema.safeParse(json);
    if (ok.success) return ok.data.token;
  } else {
    const err = tokenizeErrorSchema.safeParse(json);
    if (err.success) throw new TokenizeFailure(err.data.error);
  }
  throw new ApiRequestError(
    res.status,
    "bad_response",
    "The payment processor sent an unexpected response.",
  );
}

export class TokenizeFailure extends Error {
  constructor(readonly reason: "invalid_card" | "expired_card") {
    super(reason);
    this.name = "TokenizeFailure";
  }
}

// ---------- Auth and account ----------

export const signIn = (body: SignInRequest) =>
  request("/api/auth/sign-in", sessionResponseSchema, { method: "POST", body });

export const register = (body: RegisterRequest) =>
  request("/api/auth/register", sessionResponseSchema, { method: "POST", body });

export async function signOut(): Promise<void> {
  const res = await send(apiUrl("/api/auth/sign-out"), { method: "POST" });
  if (!res.ok) throw new ApiRequestError(res.status, "bad_response", "Could not sign out.");
}

/** The signed-in user, or null for a guest. */
export async function getSession() {
  try {
    return (await request("/api/auth/me", sessionResponseSchema)).user;
  } catch (e) {
    if (e instanceof ApiRequestError && e.status === 401) return null;
    throw e;
  }
}

export const listVehicles = () => request("/api/me/vehicles", savedVehicleSchema.array());

export const addVehicle = (body: NewSavedVehicle) =>
  request("/api/me/vehicles", savedVehicleSchema, { method: "POST", body });

export const listMyPayments = () => request("/api/me/payments", paymentHistoryItemSchema.array());

// ---------- Staff ----------

export const findCitationForStaff = (ticketNo: string) =>
  request(
    `/api/staff/citations?${new URLSearchParams({ ticketNo }).toString()}`,
    staffCitationSchema,
  );

export const recordStaffPayment = (body: StaffPaymentRequest) =>
  request("/api/staff/payments", staffPaymentResponseSchema, { method: "POST", body });

export const voidPayment = (paymentId: string, body: VoidPaymentRequest) =>
  request(`/api/staff/payments/${encodeURIComponent(paymentId)}/void`, voidPaymentResponseSchema, {
    method: "POST",
    body,
  });
