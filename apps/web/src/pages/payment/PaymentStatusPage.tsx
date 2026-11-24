import { useEffect, useRef, useState } from "react";
import { Link, useLoaderData, useNavigate, useParams } from "react-router";
import type { PaymentStatus } from "@pcs/shared";
import { getPayment } from "../../api/client.js";
import { Page } from "../../components/Page.js";
import { clearDraft } from "../../lib/draft.js";
import { formatCents, formatDateTime } from "../../lib/format.js";
import { paths } from "../../paths.js";
import type { CheckoutLocationState } from "../checkout/loader.js";
import type { PaymentData } from "./loader.js";
import { polling } from "./polling.js";

/** After this many checks, say that it's taking longer than usual. */
const SLOW_AFTER_POLLS = 4;

type Settled = Extract<PaymentStatus, { state: "succeeded" | "failed" }>;
const isSettled = (s: PaymentStatus): s is Settled =>
  s.state === "succeeded" || s.state === "failed";

export function PaymentStatusPage() {
  const data = useLoaderData<PaymentData>();
  const { paymentId = "" } = useParams();

  if (data.kind === "error") {
    return data.code === "not_found" ? (
      <Page title="Payment not found" lead="This link doesn’t match a payment you made.">
        <p>
          <Link to="/">Search for your citation</Link> to check whether it’s paid.
        </p>
      </Page>
    ) : (
      <Page
        title="Status didn’t load"
        lead="We couldn’t check this payment. Reload the page to try again."
      >
        <p>Reloading is safe. It never charges you again.</p>
      </Page>
    );
  }
  return <PaymentProgress key={paymentId} initial={data.status} />;
}

/**
 * Polls until the payment settles (F2, card S1-11). A decline sends the user back to checkout,
 * where their details are restored and only the card is empty (test T4).
 */
function PaymentProgress({ initial }: { initial: PaymentStatus }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState(initial);
  const [polls, setPolls] = useState(0);
  const [connectionTrouble, setConnectionTrouble] = useState(false);
  const receiptHeading = useRef<HTMLDivElement>(null);

  // Poll while processing, with backoff. Network errors don't stop it; it keeps trying.
  useEffect(() => {
    if (isSettled(status)) return;
    const controller = new AbortController();
    const delays = polling.delaysMs;
    const timer = setTimeout(
      () => {
        getPayment(status.paymentId, controller.signal)
          .then((next) => {
            setStatus(next);
            setConnectionTrouble(false);
          })
          .catch(() => {
            if (!controller.signal.aborted) setConnectionTrouble(true);
          })
          .finally(() => {
            if (!controller.signal.aborted) setPolls((n) => n + 1);
          });
      },
      delays[Math.min(polls, delays.length - 1)],
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [status, polls]);

  // Act on the final state.
  useEffect(() => {
    if (status.state === "failed") {
      const state: CheckoutLocationState = { failure: status.reason };
      // Replace, so Back from checkout doesn't land on this finished status page.
      void navigate(paths.checkout(status.citationId), { replace: true, state });
    }
    if (status.state === "succeeded") {
      clearDraft(status.citationId);
      receiptHeading.current?.querySelector("h1")?.focus();
    }
  }, [status, navigate]);

  if (status.state === "succeeded") {
    const r = status.receipt;
    return (
      <div ref={receiptHeading} className="receipt-page">
        <Page
          title="Payment received"
          lead={`Ticket ${r.ticketNo} is paid. Keep this receipt for your records.`}
        >
          <p className="status status--ok">Paid</p>
          <section className="card receipt" aria-label="Receipt">
            <dl className="fees">
              <div>
                <dt>Amount paid</dt>
                <dd>{formatCents(r.amountCents)}</dd>
              </div>
              <div>
                <dt>Ticket</dt>
                <dd className="mono">{r.ticketNo}</dd>
              </div>
              <div>
                <dt>Paid on</dt>
                <dd>{formatDateTime(r.paidAt)}</dd>
              </div>
              <div>
                <dt>Payment ID</dt>
                <dd className="mono receipt__id">{r.paymentId}</dd>
              </div>
            </dl>
          </section>
          <div className="actions no-print">
            <button type="button" className="btn" onClick={() => window.print()}>
              Print receipt
            </button>
            <Link className="btn" to="/">
              Pay another citation
            </Link>
          </div>
        </Page>
      </div>
    );
  }

  if (status.state === "failed") {
    // Shown only for the moment before the redirect to checkout.
    return (
      <Page title="Payment didn’t go through">
        <p role="status">Nothing was charged. Taking you back to checkout…</p>
      </Page>
    );
  }

  const slow = polls >= SLOW_AFTER_POLLS;
  return (
    <Page title="Confirming your payment" lead="This usually takes a few seconds.">
      <div className="card stack" aria-busy="true">
        <p className="spinner" role="status">
          {connectionTrouble
            ? "Lost the connection for a moment. Still checking…"
            : slow
              ? "Still confirming with the payment processor. This is taking longer than usual."
              : "Waiting for the payment processor…"}
        </p>
        <p className="meta">
          You can safely reload or leave this page and come back to this address. You won’t be
          charged twice.
        </p>
      </div>
    </Page>
  );
}
