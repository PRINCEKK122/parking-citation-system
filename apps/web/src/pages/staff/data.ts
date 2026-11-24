import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { z } from "zod";
import {
  staffPaymentRequestSchema,
  voidPaymentRequestSchema,
  type SessionUser,
  type StaffCitation,
} from "@pcs/shared";
import {
  ApiRequestError,
  findCitationForStaff,
  recordStaffPayment,
  voidPayment,
} from "../../api/client.js";
import { requireRole } from "../../session.js";

export interface StaffData {
  user: SessionUser;
  ticket: string;
  result:
    null | { kind: "found"; citation: StaffCitation } | { kind: "not_found" } | { kind: "error" };
}

/** Staff only (F3, T8): guests are sent to sign in, residents to their account. */
export async function staffLoader({ request }: LoaderFunctionArgs): Promise<StaffData> {
  const user = await requireRole(request, "staff");
  const ticket = new URL(request.url).searchParams.get("ticket")?.trim() ?? "";
  if (!ticket) return { user, ticket, result: null };
  try {
    return {
      user,
      ticket,
      result: { kind: "found", citation: await findCitationForStaff(ticket) },
    };
  } catch (e) {
    if (e instanceof ApiRequestError && e.status === 404)
      return { user, ticket, result: { kind: "not_found" } };
    if (e instanceof ApiRequestError) return { user, ticket, result: { kind: "error" } };
    throw e;
  }
}

export type StaffActionData =
  | { intent: "record"; ok: true; amountCents?: number; channel: string }
  | {
      intent: "record";
      ok: false;
      conflict?: boolean;
      fieldErrors?: Record<string, string | undefined>;
      formError?: string;
      values: Record<string, string>;
    }
  | { intent: "void"; ok: true; paymentId: string }
  | {
      intent: "void";
      ok: false;
      paymentId: string;
      fieldErrors?: Record<string, string | undefined>;
      formError?: string;
    };

const first = (errors: Record<string, string[] | undefined>) =>
  Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v?.[0]]));

export async function staffAction({ request }: ActionFunctionArgs): Promise<StaffActionData> {
  const form = await request.formData();
  const field = (k: string) => String(form.get(k) ?? "");

  if (field("intent") === "void") {
    const paymentId = field("paymentId");
    const parsed = voidPaymentRequestSchema.safeParse({ reason: field("reason") });
    if (!parsed.success) {
      return {
        intent: "void",
        ok: false,
        paymentId,
        fieldErrors: first(z.flattenError(parsed.error).fieldErrors),
      };
    }
    try {
      await voidPayment(paymentId, parsed.data);
      return { intent: "void", ok: true, paymentId };
    } catch (e) {
      if (!(e instanceof ApiRequestError)) throw e;
      return {
        intent: "void",
        ok: false,
        paymentId,
        formError:
          e.code === "payment_not_voidable"
            ? "This payment can’t be voided. It may already be voided, or it never succeeded."
            : "The void didn’t go through. Nothing changed. Try again.",
      };
    }
  }

  const values = {
    citationId: field("citationId"),
    channel: field("channel"),
    reference: field("reference"),
  };
  const parsed = staffPaymentRequestSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors = first(z.flattenError(parsed.error).fieldErrors);
    if (fieldErrors.channel) fieldErrors.channel = "Choose how the payment arrived.";
    return { intent: "record", ok: false, values, fieldErrors };
  }
  try {
    await recordStaffPayment(parsed.data);
    return { intent: "record", ok: true, channel: parsed.data.channel };
  } catch (e) {
    if (!(e instanceof ApiRequestError)) throw e;
    if (e.code === "citation_not_payable")
      return { intent: "record", ok: false, conflict: true, values };
    return {
      intent: "record",
      ok: false,
      values,
      formError: "The payment wasn’t recorded. Nothing changed. Try again.",
    };
  }
}
