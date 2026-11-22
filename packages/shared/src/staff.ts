import { z } from "zod";
import { idSchema } from "./common.js";

/** POST /api/staff/payments: a clerk records a mailed check or a walk-in payment (F3, US3). */
export const staffPaymentRequestSchema = z.object({
  citationId: idSchema,
  channel: z.enum(["mail", "walk_in"]),
  /** Check number or receipt number, so the payment can be traced to paper. */
  reference: z.string().trim().min(1, "Enter the check or receipt number.").max(64),
});
export type StaffPaymentRequest = z.infer<typeof staffPaymentRequestSchema>;

/** 201 response. Staff payments skip the gateway, so they succeed immediately. */
export const staffPaymentResponseSchema = z.object({
  paymentId: idSchema,
  state: z.literal("succeeded"),
});
export type StaffPaymentResponse = z.infer<typeof staffPaymentResponseSchema>;

/** POST /api/staff/payments/:id/void. */
export const voidPaymentRequestSchema = z.object({
  reason: z.string().trim().min(1, "Say why this payment is being voided.").max(200),
});
export type VoidPaymentRequest = z.infer<typeof voidPaymentRequestSchema>;

/** 200 response to a void. The citation is open again and can be paid. */
export const voidPaymentResponseSchema = z.object({
  paymentId: idSchema,
  citationStatus: z.literal("open"),
});
export type VoidPaymentResponse = z.infer<typeof voidPaymentResponseSchema>;
