import { z } from "zod";
import { centsSchema, idSchema, positiveCentsSchema, timestampSchema } from "./common.js";
import { identifierKindSchema, invalidFormatReasonSchema, stateCodeSchema } from "./identifiers.js";

/**
 * The five distinct lookup outcomes (feature F1). The St. Louis portal returns the
 * same "No Tickets Found" for several of these; this system never does.
 */
export const lookupOutcomes = [
  "found",
  "near_match",
  "no_open_citations",
  "unknown_identifier",
  "invalid_format",
] as const;
export const lookupOutcomeSchema = z.enum(lookupOutcomes);
export type LookupOutcome = z.infer<typeof lookupOutcomeSchema>;

/** GET /api/lookup?q=...&state=MO. Format checks happen after parsing, with classifyIdentifier. */
export const lookupQuerySchema = z.object({
  q: z.string().trim().min(1).max(64),
  state: stateCodeSchema.optional(),
});
export type LookupQuery = z.infer<typeof lookupQuerySchema>;

/** One open citation with its fee breakdown (results page, card S1-09). */
export const citationSummarySchema = z
  .object({
    id: idSchema,
    ticketNo: z.string().min(1),
    issuedAt: timestampSchema,
    baseCents: positiveCentsSchema,
    lateFeeCents: centsSchema,
    amountCents: positiveCentsSchema,
    nextIncreaseAt: timestampSchema.nullable(),
  })
  .refine((c) => c.amountCents === c.baseCents + c.lateFeeCents, {
    message: "amountCents must equal baseCents + lateFeeCents",
    path: ["amountCents"],
  });
export type CitationSummary = z.infer<typeof citationSummarySchema>;

/** The identifier the server matched, in normalized form. */
export const matchedIdentifierSchema = z.object({
  kind: identifierKindSchema,
  value: z.string().min(1),
  state: stateCodeSchema.optional(),
});
export type MatchedIdentifier = z.infer<typeof matchedIdentifierSchema>;

const found = z.object({
  outcome: z.literal("found"),
  identifier: matchedIdentifierSchema,
  citations: z.array(citationSummarySchema).min(1),
});

/**
 * A likely typo. No citations are sent until the resident confirms the suggestion and
 * looks it up, so a near match cannot be used to browse other people's tickets.
 */
const nearMatch = z.object({
  outcome: z.literal("near_match"),
  identifier: matchedIdentifierSchema,
  suggestion: z.string().min(1),
  /** Zero-based positions in `suggestion` that differ from what was typed, for highlighting. */
  changedPositions: z.array(z.number().int().nonnegative()).min(1),
});

const noOpenCitations = z.object({
  outcome: z.literal("no_open_citations"),
  identifier: matchedIdentifierSchema,
});

const unknownIdentifier = z.object({
  outcome: z.literal("unknown_identifier"),
  identifier: matchedIdentifierSchema,
});

/** Sent with HTTP 422. */
const invalidFormat = z.object({
  outcome: z.literal("invalid_format"),
  reason: invalidFormatReasonSchema,
});

export const lookupResponseSchema = z.discriminatedUnion("outcome", [
  found,
  nearMatch,
  noOpenCitations,
  unknownIdentifier,
  invalidFormat,
]);
export type LookupResponse = z.infer<typeof lookupResponseSchema>;
