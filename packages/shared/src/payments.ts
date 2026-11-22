import { z } from "zod";
import { idSchema, positiveCentsSchema, timestampSchema } from "./common.js";
import { stateCodeSchema } from "./identifiers.js";

/** Payment lifecycle (feature F2). `succeeded` and `failed` are terminal and never change. */
export const paymentStates = ["created", "processing", "succeeded", "failed"] as const;
export const paymentStateSchema = z.enum(paymentStates);
export type PaymentState = z.infer<typeof paymentStateSchema>;

export const paymentChannels = ["online", "mail", "walk_in"] as const;
export const paymentChannelSchema = z.enum(paymentChannels);
export type PaymentChannel = z.infer<typeof paymentChannelSchema>;

/** Sent in the Idempotency-Key header; the checkout page makes one when it opens. */
export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";
export const idempotencyKeySchema = z.uuid();

/**
 * Payer details. These are the fields that must survive a declined card (US2, test T4);
 * the card itself goes straight to the gateway and is never part of this schema.
 */
export const payerSchema = z.object({
  name: z.string().trim().min(1, "Enter the name on the card.").max(100),
  email: z.email("Enter an email address like name@example.com."),
  address: z.object({
    line1: z.string().trim().min(1, "Enter a street address.").max(120),
    line2: z.string().trim().max(120).optional(),
    city: z.string().trim().min(1, "Enter a city.").max(80),
    state: stateCodeSchema,
    postalCode: z
      .string()
      .trim()
      .regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit ZIP code."),
  }),
});
export type Payer = z.infer<typeof payerSchema>;

/** POST /api/payments body. The server recomputes the amount and rejects a mismatch (409). */
export const paymentRequestSchema = z.object({
  citationId: idSchema,
  amountCents: positiveCentsSchema,
  payer: payerSchema,
  /** Single-use token from the gateway for the test card. */
  token: z.string().min(1).max(200),
});
export type PaymentRequest = z.infer<typeof paymentRequestSchema>;

/** 202 response to POST /api/payments, and its replay for the same key and body. */
export const paymentAcceptedSchema = z.object({
  paymentId: idSchema,
  state: z.literal("processing"),
});
export type PaymentAccepted = z.infer<typeof paymentAcceptedSchema>;

export const receiptSchema = z.object({
  paymentId: idSchema,
  citationId: idSchema,
  ticketNo: z.string().min(1),
  amountCents: positiveCentsSchema,
  channel: paymentChannelSchema,
  paidAt: timestampSchema,
});
export type Receipt = z.infer<typeof receiptSchema>;

/** Why a payment ended in `failed`. `expired` is set by the reconciler after 10 minutes (I3). */
export const paymentFailureReasons = ["card_declined", "gateway_error", "expired"] as const;
export const paymentFailureReasonSchema = z.enum(paymentFailureReasons);
export type PaymentFailureReason = z.infer<typeof paymentFailureReasonSchema>;

/** GET /api/payments/:id. The client polls until the state is terminal. */
export const paymentStatusSchema = z.discriminatedUnion("state", [
  z.object({ paymentId: idSchema, state: z.literal("created") }),
  z.object({ paymentId: idSchema, state: z.literal("processing") }),
  z.object({ paymentId: idSchema, state: z.literal("succeeded"), receipt: receiptSchema }),
  z.object({
    paymentId: idSchema,
    state: z.literal("failed"),
    reason: paymentFailureReasonSchema,
  }),
]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export function isTerminal(state: PaymentState): boolean {
  return state === "succeeded" || state === "failed";
}
