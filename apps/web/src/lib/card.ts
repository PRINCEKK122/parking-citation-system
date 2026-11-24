import { z } from "zod";
import type { TokenizeRequest } from "@pcs/shared";

/**
 * Card fields, checked in the browser only. The card goes to the gateway for a token and
 * never reaches our API, so this schema is deliberately not in the shared package.
 */

const digits = (s: string) => s.replace(/[\s-]/g, "");

/** Luhn checksum: catches most single-digit typos and swapped neighbours. */
export function luhnValid(number: string): boolean {
  let sum = 0;
  for (let i = 0; i < number.length; i++) {
    let d = Number(number[number.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

const EXPIRY = /^(0[1-9]|1[0-2])\s*\/\s*(\d{2})$/;

export function cardSchema(now: () => Date = () => new Date()) {
  return z.object({
    number: z
      .string()
      .transform(digits)
      .refine((n) => n.length > 0, "Enter the card number.")
      .refine(
        (n) => /^\d{12,19}$/.test(n) && luhnValid(n),
        "Check the card number. It doesn’t look right.",
      ),
    expiry: z
      .string()
      .trim()
      .refine((s) => EXPIRY.test(s), "Enter the expiry date as MM/YY, for example 04/29.")
      .refine((s) => {
        const m = EXPIRY.exec(s);
        if (!m) return true; // reported by the check above
        const t = now();
        const year = 2000 + Number(m[2]);
        const month = Number(m[1]);
        return year > t.getFullYear() || (year === t.getFullYear() && month >= t.getMonth() + 1);
      }, "This card has expired. Use a different card."),
    cvc: z
      .string()
      .trim()
      .regex(/^\d{3,4}$/, "Enter the 3 or 4 digit security code from the back of the card."),
  });
}

export type CardFields = z.output<ReturnType<typeof cardSchema>>;

/** Turn the validated form fields into the gateway's token request. */
export function toTokenizeRequest(card: CardFields): TokenizeRequest {
  const m = EXPIRY.exec(card.expiry)!;
  return {
    number: card.number,
    expMonth: Number(m[1]),
    expYear: 2000 + Number(m[2]),
    cvc: card.cvc,
  };
}
