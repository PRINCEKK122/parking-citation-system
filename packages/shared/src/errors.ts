import { z } from "zod";

/** Every error code the API can send. Clients branch on the code, never on the message. */
export const apiErrorCodes = [
  "validation_failed",
  "unauthorized",
  "forbidden",
  "not_found",
  "rate_limited",
  /** 409: the citation is already paid or voided (US3). */
  "citation_not_payable",
  /** 409: the citation's amount changed since the page loaded, e.g. a late fee was added. */
  "amount_changed",
  /** 422: an Idempotency-Key was reused with a different request body. */
  "idempotency_key_reused",
  "internal",
] as const;
export const apiErrorCodeSchema = z.enum(apiErrorCodes);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

/** One JSON error shape for every API error response. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
