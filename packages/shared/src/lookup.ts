import { z } from "zod";

/**
 * The five distinct lookup outcomes (feature F1). The St. Louis portal returns the
 * same "No Tickets Found" for several of these; this system never does.
 * Full request/response schemas are filled in by card S1-04.
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
