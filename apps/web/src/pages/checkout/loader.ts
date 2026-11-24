import type { LoaderFunctionArgs } from "react-router";
import type { CitationSummary, PaymentFailureReason } from "@pcs/shared";
import { ApiRequestError, getCitation, type ClientErrorCode } from "../../api/client.js";

export type CheckoutData =
  | { kind: "ready"; citation: CitationSummary; payable: boolean }
  | { kind: "error"; code: ClientErrorCode };

/** Navigation state the payment status page sends when a payment fails (card S1-11). */
export interface CheckoutLocationState {
  failure?: PaymentFailureReason;
}

export async function checkoutLoader({
  params,
  request,
}: LoaderFunctionArgs): Promise<CheckoutData> {
  try {
    const { citation, payable } = await getCitation(params.citationId ?? "", request.signal);
    return { kind: "ready", citation, payable };
  } catch (e) {
    if (e instanceof ApiRequestError) return { kind: "error", code: e.code };
    throw e;
  }
}
