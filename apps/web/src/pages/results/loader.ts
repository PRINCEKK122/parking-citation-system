import type { LoaderFunctionArgs } from "react-router";
import { US_STATES, type LookupResponse, type StateCode } from "@pcs/shared";
import { ApiRequestError, lookup, type ClientErrorCode } from "../../api/client.js";

export type ResultsData =
  | { kind: "empty" }
  | { kind: "result"; q: string; state?: StateCode; result: LookupResponse }
  | { kind: "error"; q: string; state?: StateCode; code: ClientErrorCode };

const asState = (s: string | null): StateCode | undefined =>
  US_STATES.find(([c]) => c === s?.toUpperCase())?.[0];

/**
 * Runs the lookup before the results page renders, so the URL alone (back button, refresh,
 * a shared link) is enough to show a result. API failures become an error screen in place
 * rather than the generic route error page.
 */
export async function resultsLoader({ request }: LoaderFunctionArgs): Promise<ResultsData> {
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim() ?? "";
  if (!q) return { kind: "empty" };
  const state = asState(params.get("state"));

  try {
    const result = await lookup({ q, state }, request.signal);
    return { kind: "result", q, state, result };
  } catch (e) {
    if (e instanceof ApiRequestError) return { kind: "error", q, state, code: e.code };
    throw e;
  }
}
