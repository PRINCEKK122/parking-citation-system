import { z } from "zod";
import { US_STATES, type StateCode } from "./states.js";

/**
 * Classifying what a resident typed into the single lookup field (feature F1, design step a).
 * Shared so the web app can show the same format error inline that the API would return.
 */

const STATE_CODES = US_STATES.map(([code]) => code) as [StateCode, ...StateCode[]];
export const stateCodeSchema = z.enum(STATE_CODES);

export const identifierKinds = ["ticket", "plate", "vin"] as const;
export const identifierKindSchema = z.enum(identifierKinds);
export type IdentifierKind = z.infer<typeof identifierKindSchema>;

/** Why an input is not a well-formed identifier. Returned with `invalid_format`. */
export const invalidFormatReasons = [
  "empty",
  "characters",
  "length",
  "check_digit",
  "missing_state",
] as const;
export const invalidFormatReasonSchema = z.enum(invalidFormatReasons);
export type InvalidFormatReason = z.infer<typeof invalidFormatReasonSchema>;

/** Ticket numbers are "T" followed by this many digits, e.g. T00012345 (a dash is allowed). */
export const TICKET_DIGITS = 8;
export const VIN_LENGTH = 17;
export const PLATE_MIN = 2;
export const PLATE_MAX = 8;

export type ClassifiedIdentifier =
  | { ok: true; kind: "ticket"; value: string }
  | { ok: true; kind: "vin"; value: string }
  | { ok: true; kind: "plate"; value: string; state: StateCode }
  | { ok: false; reason: InvalidFormatReason };

/** Uppercase and remove spaces and dashes. */
export function normalizeInput(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]+/g, "");
}

// 49 CFR 565.15: letter values and position weights for the VIN check digit.
const VIN_VALUES: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
}; // prettier-ignore
const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/** I, O and Q never appear in a VIN, so they are read as the digits they are confused with. */
export function normalizeVin(vin: string): string {
  return normalizeInput(vin).replace(/I/g, "1").replace(/[OQ]/g, "0");
}

/** The check digit (position 9) a 17-character VIN should have, or null if it has illegal characters. */
export function vinCheckDigit(vin: string): string | null {
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return null;
  let sum = 0;
  for (let i = 0; i < VIN_LENGTH; i++) {
    const ch = vin.charAt(i);
    const value = /\d/.test(ch) ? Number(ch) : (VIN_VALUES[ch] ?? 0);
    sum += value * (VIN_WEIGHTS[i] ?? 0);
  }
  const r = sum % 11;
  return r === 10 ? "X" : String(r);
}

export function isValidVin(vin: string): boolean {
  return vinCheckDigit(vin) === vin.charAt(8);
}

/**
 * Decide whether the input is a ticket number, a VIN or a plate. Order matters: a ticket
 * prefix wins, then 17 characters means VIN, then a short code with a state is a plate.
 */
export function classifyIdentifier(raw: string, state?: StateCode): ClassifiedIdentifier {
  const s = normalizeInput(raw);
  if (!s) return { ok: false, reason: "empty" };
  if (!/^[A-Z0-9]+$/.test(s)) return { ok: false, reason: "characters" };

  if (/^T\d+$/.test(s) && s.length > PLATE_MAX) {
    return s.length === TICKET_DIGITS + 1
      ? { ok: true, kind: "ticket", value: s }
      : { ok: false, reason: "length" };
  }

  if (s.length === VIN_LENGTH) {
    const vin = normalizeVin(s);
    return isValidVin(vin)
      ? { ok: true, kind: "vin", value: vin }
      : { ok: false, reason: "check_digit" };
  }

  if (s.length >= PLATE_MIN && s.length <= PLATE_MAX) {
    return state
      ? { ok: true, kind: "plate", value: s, state }
      : { ok: false, reason: "missing_state" };
  }

  return { ok: false, reason: "length" };
}

/** Plain-language text for each format error, shown under the search field. */
export const invalidFormatMessages: Record<InvalidFormatReason, string> = {
  empty: "Enter a ticket number, a license plate, or a VIN.",
  characters: "Use only letters and numbers.",
  length: `Ticket numbers are T plus ${TICKET_DIGITS} digits, VINs are ${VIN_LENGTH} characters, and plates are ${PLATE_MIN}–${PLATE_MAX} characters.`,
  check_digit: "This VIN has a mistake in it. Check each character against your registration.",
  missing_state: "Choose the state on the license plate.",
};
