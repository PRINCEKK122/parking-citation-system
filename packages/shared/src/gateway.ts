import { z } from "zod";

/**
 * The simulated gateway's test cards. The browser sends the card to the gateway, which
 * returns a token; card numbers never reach the API (midterm Section 4).
 */
export const testCardOutcomes = ["succeeds", "declined", "gateway_error", "slow"] as const;
export type TestCardOutcome = (typeof testCardOutcomes)[number];

export const TEST_CARDS: ReadonlyArray<{
  number: string;
  outcome: TestCardOutcome;
  label: string;
}> = [
  { number: "4242424242424242", outcome: "succeeds", label: "Payment succeeds" },
  { number: "4000000000000002", outcome: "declined", label: "Card is declined" },
  { number: "4000000000000119", outcome: "gateway_error", label: "Gateway error" },
  { number: "4000000000000077", outcome: "slow", label: "Succeeds after a long wait" },
];

/** POST {gateway}/v1/tokens */
export const tokenizeRequestSchema = z.object({
  number: z.string().regex(/^\d{12,19}$/),
  expMonth: z.number().int().min(1).max(12),
  expYear: z.number().int().min(2000).max(2100),
  cvc: z.string().regex(/^\d{3,4}$/),
});
export type TokenizeRequest = z.infer<typeof tokenizeRequestSchema>;

export const tokenizeResponseSchema = z.object({ token: z.string().min(1) });
export type TokenizeResponse = z.infer<typeof tokenizeResponseSchema>;

/** 400 from the gateway when it will not issue a token, e.g. a number that is not a test card. */
export const tokenizeErrorSchema = z.object({
  error: z.enum(["invalid_card", "expired_card"]),
});
export type TokenizeError = z.infer<typeof tokenizeErrorSchema>;
