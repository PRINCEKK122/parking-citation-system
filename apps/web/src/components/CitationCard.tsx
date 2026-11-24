import type { ReactNode } from "react";
import type { CitationSummary } from "@pcs/shared";
import { daysUntil, formatCents, formatDate } from "../lib/format.js";

/** Warn when the amount goes up within this many days. */
export const INCREASE_SOON_DAYS = 7;

function increaseText(iso: string, now: Date): { text: string; soon: boolean } {
  const days = daysUntil(iso, now);
  const when = days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  return { text: `Goes up on ${formatDate(iso)} (${when})`, soon: days <= INCREASE_SOON_DAYS };
}

interface CitationCardProps {
  citation: CitationSummary;
  /** Action area, e.g. the Pay button. */
  children?: ReactNode;
  now?: Date;
}

/** One citation with its fee breakdown (F1, card S1-09). Also used as the checkout summary. */
export function CitationCard({ citation: c, children, now = new Date() }: CitationCardProps) {
  const increase = c.nextIncreaseAt ? increaseText(c.nextIncreaseAt, now) : null;
  return (
    <article className="card citation" aria-labelledby={`cit-${c.id}`}>
      <header className="citation__head">
        <h2 id={`cit-${c.id}`} className="citation__no mono">
          <span className="sr-only">Ticket</span> {c.ticketNo}
        </h2>
        <p className="meta">Issued {formatDate(c.issuedAt)}</p>
      </header>

      <dl className="fees">
        <div>
          <dt>Base fine</dt>
          <dd>{formatCents(c.baseCents)}</dd>
        </div>
        <div>
          <dt>Late fees</dt>
          <dd>{c.lateFeeCents > 0 ? formatCents(c.lateFeeCents) : "None"}</dd>
        </div>
        <div className="fees__total">
          <dt>Total due</dt>
          <dd>{formatCents(c.amountCents)}</dd>
        </div>
      </dl>

      {increase ? (
        <p className={increase.soon ? "increase increase--soon" : "increase"}>{increase.text}</p>
      ) : (
        <p className="increase">This amount will not go up.</p>
      )}

      {children}
    </article>
  );
}
