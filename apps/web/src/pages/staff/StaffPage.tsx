import { useState } from "react";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import type { CitationStatus, StaffCitation, StaffPaymentRecord } from "@pcs/shared";
import { Page } from "../../components/Page.js";
import { TextField } from "../../components/TextField.js";
import { describeIdentifier, formatCents, formatDate, formatDateTime } from "../../lib/format.js";
import type { StaffActionData, StaffData } from "./data.js";

const CHANNELS = { online: "Online", mail: "Mailed check", walk_in: "Walk-in" } as const;
const STATUS: Record<CitationStatus, { text: string; tone: string }> = {
  open: { text: "Open", tone: "warn" },
  paid: { text: "Paid", tone: "ok" },
  voided: { text: "Voided", tone: "neutral" },
};

/**
 * True only while this form's request is being sent. After an action, React Router reloads
 * the page data with the old form data still attached; counting that as busy would leave the
 * button disabled and swallow a quick retry.
 */
function useSubmitting(field: string, value: string): boolean {
  const nav = useNavigation();
  return nav.state === "submitting" && nav.formData?.get(field) === value;
}

/** Staff console (F3, US3, card S1-13): find a citation, record mail/walk-in payments, void. */
export function StaffPage() {
  const { ticket, result } = useLoaderData<StaffData>();
  const action = useActionData<StaffActionData>();

  return (
    <Page
      title="Staff console"
      lead="Record mailed and walk-in payments, and void payments made in error."
    >
      <Form
        method="get"
        className="card search-row"
        role="search"
        aria-label="Find a citation by ticket number"
      >
        <TextField
          label="Ticket number"
          name="ticket"
          className="mono"
          defaultValue={ticket}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
        <button type="submit" className="btn btn--primary">
          Find
        </button>
      </Form>

      <ActionResult action={action} />

      {result?.kind === "not_found" ? (
        <p className="alert alert--warn" role="status">
          No citation has ticket number <span className="mono">{ticket}</span>. Check the number on
          the paper ticket or envelope.
        </p>
      ) : null}
      {result?.kind === "error" ? (
        <p className="alert alert--error" role="alert">
          The search didn’t finish. Try again.
        </p>
      ) : null}
      {result?.kind === "found" ? (
        <CitationPanel key={result.citation.id} citation={result.citation} />
      ) : null}
    </Page>
  );
}

function ActionResult({ action }: { action: StaffActionData | undefined }) {
  if (!action) return null;
  if (action.intent === "record" && action.ok) {
    return (
      <p className="alert alert--ok" role="status">
        {CHANNELS[action.channel as keyof typeof CHANNELS]} payment recorded. The citation is now
        paid.
      </p>
    );
  }
  if (action.intent === "record" && !action.ok && action.conflict) {
    // US3: a clear, specific message, never a generic error.
    return (
      <div className="alert alert--error" role="alert">
        <p>
          <strong>Already paid: no payment was recorded.</strong>
        </p>
        <p>
          This citation was paid before your entry was saved, most likely online. Do not process
          this check or cash as payment for it. Its payment history below shows the earlier payment.
          The attempt has been logged.
        </p>
      </div>
    );
  }
  if (action.intent === "void" && action.ok) {
    return (
      <p className="alert alert--ok" role="status">
        Payment voided. The citation is open again.
      </p>
    );
  }
  if (!action.ok && action.formError) {
    return (
      <p className="alert alert--error" role="alert">
        {action.formError}
      </p>
    );
  }
  return null;
}

function CitationPanel({ citation: c }: { citation: StaffCitation }) {
  const status = STATUS[c.status];
  return (
    <section className="card stack" aria-labelledby="staff-cit-h">
      <div className="citation__head">
        <h2 id="staff-cit-h" className="citation__no mono">
          {c.ticketNo}
        </h2>
        <span className={`tag tag--${status.tone}`}>{status.text}</span>
      </div>
      <dl className="fees">
        <div>
          <dt>Vehicle</dt>
          <dd>{describeIdentifier(c.vehicle)}</dd>
        </div>
        <div>
          <dt>Issued</dt>
          <dd>{formatDate(c.issuedAt)}</dd>
        </div>
        <div className="fees__total">
          <dt>Amount</dt>
          <dd>{formatCents(c.amountCents)}</dd>
        </div>
      </dl>

      {c.status === "open" ? (
        <RecordPaymentForm citation={c} />
      ) : (
        <p className="meta">
          No payment can be recorded while this citation is {status.text.toLowerCase()}. To correct
          a mistaken payment, void it below first.
        </p>
      )}

      <h3>Payments</h3>
      {c.payments.length ? (
        <ul className="payments">
          {c.payments.map((p) => (
            <PaymentRow key={p.paymentId} payment={p} />
          ))}
        </ul>
      ) : (
        <p className="meta">No payments yet.</p>
      )}
    </section>
  );
}

function RecordPaymentForm({ citation }: { citation: StaffCitation }) {
  const action = useActionData<StaffActionData>();
  const failed = action?.intent === "record" && !action.ok ? action : undefined;
  const busy = useSubmitting("intent", "record");
  return (
    <Form method="post" className="stack record" noValidate>
      <input type="hidden" name="intent" value="record" />
      <input type="hidden" name="citationId" value={citation.id} />
      <h3>Record a payment</h3>
      <fieldset
        className="field"
        aria-describedby={failed?.fieldErrors?.channel ? "channel-err" : undefined}
      >
        <legend className="field__legend">How did it arrive?</legend>
        <div className="radios">
          {(["mail", "walk_in"] as const).map((ch) => (
            <label key={ch} className="radio">
              <input
                type="radio"
                name="channel"
                value={ch}
                defaultChecked={failed?.values.channel === ch}
              />
              {CHANNELS[ch]}
            </label>
          ))}
        </div>
        {failed?.fieldErrors?.channel ? (
          <p id="channel-err" className="field__error">
            {failed.fieldErrors.channel}
          </p>
        ) : null}
      </fieldset>
      <TextField
        label="Check or receipt number"
        name="reference"
        defaultValue={failed?.values.reference}
        error={failed?.fieldErrors?.reference}
        autoComplete="off"
      />
      <div>
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? "Recording…" : `Record ${formatCents(citation.amountCents)} payment`}
        </button>
      </div>
    </Form>
  );
}

function PaymentRow({ payment: p }: { payment: StaffPaymentRecord }) {
  const action = useActionData<StaffActionData>();
  const voidFailed =
    action?.intent === "void" && !action.ok && action.paymentId === p.paymentId
      ? action
      : undefined;
  const [confirming, setConfirming] = useState(Boolean(voidFailed));
  const busy = useSubmitting("paymentId", p.paymentId);
  const canVoid = p.state === "succeeded" && !p.voidedAt;

  return (
    <li className="payment">
      <div>
        <p>
          <strong>{formatCents(p.amountCents)}</strong> · {CHANNELS[p.channel]}
          {p.reference ? (
            <>
              {" "}
              · ref <span className="mono">{p.reference}</span>
            </>
          ) : null}
        </p>
        <p className="meta">
          {formatDateTime(p.createdAt)} ·{" "}
          {p.voidedAt
            ? `Voided ${formatDateTime(p.voidedAt)}`
            : p.state === "succeeded"
              ? "Succeeded"
              : p.state}
        </p>
      </div>
      {canVoid && !confirming ? (
        <button type="button" className="btn" onClick={() => setConfirming(true)}>
          Void…
        </button>
      ) : null}
      {canVoid && confirming ? (
        <Form method="post" className="stack void" noValidate>
          <input type="hidden" name="intent" value="void" />
          <input type="hidden" name="paymentId" value={p.paymentId} />
          <TextField
            label="Reason for voiding"
            name="reason"
            error={voidFailed?.fieldErrors?.reason}
            autoFocus
          />
          <div className="actions">
            <button type="submit" className="btn btn--danger" disabled={busy}>
              {busy ? "Voiding…" : "Void this payment"}
            </button>
            <button type="button" className="btn" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </Form>
      ) : null}
    </li>
  );
}
