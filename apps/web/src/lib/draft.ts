import { z } from "zod";

/**
 * The payer's details for one citation, kept in this tab while they pay, so a declined card
 * or a reload never makes them type it all again (US2). Card details are never stored.
 *
 * The midterm design keeps this draft on the server (PaymentDraft); this browser copy covers
 * Sprint 1, when there is no server, and remains a fallback afterwards.
 */

const draftSchema = z.object({
  name: z.string(),
  email: z.string(),
  address: z.object({
    line1: z.string(),
    line2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
  }),
});
export type PayerDraft = z.infer<typeof draftSchema>;

const key = (citationId: string) => `pcs.checkout.draft.${citationId}`;

export function loadDraft(citationId: string): PayerDraft | null {
  try {
    const raw = sessionStorage.getItem(key(citationId));
    const parsed = draftSchema.safeParse(raw ? JSON.parse(raw) : null);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveDraft(citationId: string, draft: PayerDraft): void {
  try {
    sessionStorage.setItem(key(citationId), JSON.stringify(draftSchema.parse(draft)));
  } catch {
    // Storage can be full or blocked; the form still works, it just won't survive a reload.
  }
}

export function clearDraft(citationId: string): void {
  try {
    sessionStorage.removeItem(key(citationId));
  } catch {
    // Nothing to do.
  }
}
