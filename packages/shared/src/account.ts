import { z } from "zod";
import { idSchema, positiveCentsSchema, timestampSchema } from "./common.js";
import { matchedIdentifierSchema } from "./lookup.js";
import { paymentChannelSchema, paymentStateSchema } from "./payments.js";

/** Roles from the policy table (F3). Guests have no session, so they are not a stored role. */
export const userRoles = ["resident", "staff"] as const;
export const userRoleSchema = z.enum(userRoles);
export type UserRole = z.infer<typeof userRoleSchema>;

export const sessionUserSchema = z.object({
  id: idSchema,
  email: z.email(),
  role: userRoleSchema,
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

/** POST /api/auth/sign-in */
export const signInRequestSchema = z.object({
  email: z.email("Enter the email address you registered with."),
  password: z.string().min(1, "Enter your password."),
});
export type SignInRequest = z.infer<typeof signInRequestSchema>;

/** POST /api/auth/register. Only residents can register; staff accounts are created by admins. */
export const registerRequestSchema = z.object({
  email: z.email("Enter an email address like name@example.com."),
  password: z.string().min(12, "Use at least 12 characters.").max(200),
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

/** Response to sign-in, register and GET /api/auth/me. */
export const sessionResponseSchema = z.object({ user: sessionUserSchema });
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

/** A vehicle a resident saved for one-tap lookup (GET/POST /api/me/vehicles). */
export const savedVehicleSchema = z.object({
  id: idSchema,
  nickname: z.string().trim().min(1).max(40),
  identifier: matchedIdentifierSchema,
});
export type SavedVehicle = z.infer<typeof savedVehicleSchema>;

export const newSavedVehicleSchema = savedVehicleSchema.omit({ id: true });
export type NewSavedVehicle = z.infer<typeof newSavedVehicleSchema>;

/** One row of a resident's payment history (GET /api/me/payments). */
export const paymentHistoryItemSchema = z.object({
  paymentId: idSchema,
  ticketNo: z.string().min(1),
  amountCents: positiveCentsSchema,
  state: paymentStateSchema,
  createdAt: timestampSchema,
});
export type PaymentHistoryItem = z.infer<typeof paymentHistoryItemSchema>;

export const citationStatuses = ["open", "paid", "voided"] as const;
export const citationStatusSchema = z.enum(citationStatuses);
export type CitationStatus = z.infer<typeof citationStatusSchema>;

/** A payment as staff see it, including mail and walk-in entries and voids. */
export const staffPaymentRecordSchema = z.object({
  paymentId: idSchema,
  channel: paymentChannelSchema,
  state: paymentStateSchema,
  amountCents: positiveCentsSchema,
  createdAt: timestampSchema,
  reference: z.string().optional(),
  voidedAt: timestampSchema.optional(),
});
export type StaffPaymentRecord = z.infer<typeof staffPaymentRecordSchema>;

/** GET /api/staff/citations?ticketNo=... */
export const staffCitationSchema = z.object({
  id: idSchema,
  ticketNo: z.string().min(1),
  status: citationStatusSchema,
  issuedAt: timestampSchema,
  amountCents: positiveCentsSchema,
  vehicle: matchedIdentifierSchema,
  payments: z.array(staffPaymentRecordSchema),
});
export type StaffCitation = z.infer<typeof staffCitationSchema>;
