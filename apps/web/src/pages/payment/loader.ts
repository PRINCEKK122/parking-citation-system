import type { LoaderFunctionArgs } from "react-router";
import type { PaymentStatus } from "@pcs/shared";
import { ApiRequestError, getPayment, type ClientErrorCode } from "../../api/client.js";

export type PaymentData =
  { kind: "ready"; status: PaymentStatus } | { kind: "error"; code: ClientErrorCode };

export async function paymentLoader({ params, request }: LoaderFunctionArgs): Promise<PaymentData> {
  try {
    return { kind: "ready", status: await getPayment(params.paymentId ?? "", request.signal) };
  } catch (e) {
    if (e instanceof ApiRequestError) return { kind: "error", code: e.code };
    throw e;
  }
}
