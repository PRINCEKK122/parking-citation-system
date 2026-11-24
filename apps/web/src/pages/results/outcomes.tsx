import { Link, useRevalidator } from "react-router";
import {
  invalidFormatMessages,
  type InvalidFormatReason,
  type LookupResponse,
  type StateCode,
} from "@pcs/shared";
import type { ClientErrorCode } from "../../api/client.js";
import { Page } from "../../components/Page.js";
import { SearchForm } from "../../components/SearchForm.js";
import { CitationCard } from "../../components/CitationCard.js";
import { describeIdentifier, formatCents, kindName } from "../../lib/format.js";
import { paths } from "../../paths.js";

type Outcome<O extends LookupResponse["outcome"]> = Extract<LookupResponse, { outcome: O }>;

/** Link back to the search page with the last entry filled in, for "change what I entered". */
const editLink = (q: string, state?: string) =>
  `/?${new URLSearchParams(state ? { q, state } : { q }).toString()}`;

function Status({
  tone,
  label,
}: {
  tone: "info" | "warn" | "ok" | "neutral" | "error";
  label: string;
}) {
  return <p className={`status status--${tone}`}>{label}</p>;
}

// ---------- found ----------

export function FoundView({ result }: { result: Outcome<"found"> }) {
  const n = result.citations.length;
  const total = result.citations.reduce((sum, c) => sum + c.amountCents, 0);
  return (
    <Page
      title={n === 1 ? "1 open citation" : `${n} open citations`}
      lead={<>For {describeIdentifier(result.identifier)}.</>}
    >
      <Status tone="info" label="Citations found" />
      {n > 1 ? (
        <p className="summary">
          <span>
            Total for all {n}: <strong>{formatCents(total)}</strong>.
          </span>{" "}
          Each citation is paid separately. Choose one to start.
        </p>
      ) : null}
      <ul className="citations">
        {result.citations.map((c) => (
          <li key={c.id}>
            <CitationCard citation={c}>
              <Link className="btn btn--primary" to={paths.checkout(c.id)}>
                Pay {formatCents(c.amountCents)}{" "}
                <span className="sr-only">for ticket {c.ticketNo}</span>
              </Link>
            </CitationCard>
          </li>
        ))}
      </ul>
      <p>
        <Link to="/">Search for another vehicle</Link>
      </p>
    </Page>
  );
}

// ---------- near_match ----------

/** The suggestion with each corrected character marked, read out as "corrected" too. */
function Highlighted({ value, positions }: { value: string; positions: number[] }) {
  return (
    <span className="mono highlight">
      {[...value].map((ch, i) =>
        positions.includes(i) ? (
          <mark key={i}>
            {ch}
            <span className="sr-only"> (corrected)</span>
          </mark>
        ) : (
          <span key={i}>{ch}</span>
        ),
      )}
    </span>
  );
}

export function NearMatchView({ result }: { result: Outcome<"near_match"> }) {
  const { identifier, suggestion, changedPositions } = result;
  const kind = kindName(identifier);
  return (
    <Page title={`Did you mean ${suggestion}?`}>
      <Status tone="warn" label="Possible typo" />
      <div className="card stack">
        <p>
          You entered <span className="mono">{identifier.value}</span>. We have no {kind} like that
          {identifier.state ? " in this state" : ""}, but we have one that differs only by a
          look-alike character:
        </p>
        <p className="suggestion">
          <Highlighted value={suggestion} positions={changedPositions} />
        </p>
        <p className="meta">
          Citations are shown only after you confirm, so you never see someone else’s tickets by
          mistake.
        </p>
        <div className="actions">
          <Link className="btn btn--primary" to={paths.results(suggestion, identifier.state)}>
            Yes, show citations for {suggestion}
          </Link>
          <Link className="btn" to={editLink(identifier.value, identifier.state)}>
            No, change what I entered
          </Link>
        </div>
      </div>
    </Page>
  );
}

// ---------- no_open_citations ----------

export function NoOpenCitationsView({ result }: { result: Outcome<"no_open_citations"> }) {
  return (
    <Page
      title="Nothing to pay"
      lead={<>We found {describeIdentifier(result.identifier)}, and it has no unpaid citations.</>}
    >
      <Status tone="ok" label="No open citations" />
      <div className="card stack">
        <p>Citations that are already paid don’t appear here.</p>
        <p>
          <Link to={paths.signIn()}>Sign in</Link> to see your payment history, or{" "}
          <Link to="/">search for another vehicle</Link>.
        </p>
      </div>
    </Page>
  );
}

// ---------- unknown_identifier ----------

export function UnknownIdentifierView({ result }: { result: Outcome<"unknown_identifier"> }) {
  const id = result.identifier;
  return (
    <Page
      title={`We have no record of this ${kindName(id)}`}
      lead={
        <>
          {describeIdentifier(id)} isn’t in our records. This does <strong>not</strong> mean you
          have no tickets.
        </>
      }
    >
      <Status tone="neutral" label="Not found" />
      <div className="card stack">
        <h2>Things to check</h2>
        <ul className="checklist">
          <li>
            Compare each character with your ticket or registration. O and 0, I and 1, B and 8 are
            easy to mix up.
          </li>
          {id.kind === "plate" ? <li>Make sure the state matches the one on the plate.</li> : null}
          <li>Try a different identifier: the ticket number, the plate, or the VIN.</li>
          <li>A ticket issued in the last few days may not be in the system yet.</li>
        </ul>
      </div>
      <SearchForm defaultQuery={id.value} defaultState={id.state} />
    </Page>
  );
}

// ---------- invalid_format ----------

export function InvalidFormatView({
  reason,
  q,
  state,
}: {
  reason: InvalidFormatReason;
  q: string;
  state?: StateCode;
}) {
  return (
    <Page title="Check what you entered" lead={invalidFormatMessages[reason]}>
      <Status tone="error" label="Not a valid ticket number, plate, or VIN" />
      <SearchForm defaultQuery={q} defaultState={state} initialError={reason} />
    </Page>
  );
}

// ---------- request failed ----------

export function ErrorView({
  code,
  q,
  state,
}: {
  code: ClientErrorCode;
  q: string;
  state?: StateCode;
}) {
  const revalidator = useRevalidator();
  const busy = revalidator.state !== "idle";

  if (code === "rate_limited") {
    return (
      <Page
        title="Too many searches"
        lead="To protect other people’s records, searches are limited. Wait a minute, then try again."
      >
        <Status tone="error" label="Search limit reached" />
        <SearchForm defaultQuery={q} defaultState={state} />
      </Page>
    );
  }

  return (
    <Page
      title="The search didn’t finish"
      lead={
        code === "network_error"
          ? "We couldn’t reach the server. Check your connection, then try again."
          : "Something went wrong on our side. Your search wasn’t the problem."
      }
    >
      <Status tone="error" label="Search failed" />
      <div className="actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void revalidator.revalidate()}
          disabled={busy}
        >
          {busy ? "Trying again…" : "Try again"}
        </button>
        <Link className="btn" to={editLink(q, state)}>
          Change what I entered
        </Link>
      </div>
    </Page>
  );
}
