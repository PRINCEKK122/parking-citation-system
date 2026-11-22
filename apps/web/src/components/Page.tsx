import type { ReactNode } from "react";

interface PageProps {
  /** Page heading; also used for the browser tab title. */
  title: string;
  /** One sentence under the heading. */
  lead?: ReactNode;
  children?: ReactNode;
}

/** Every route renders through this, so each page has one h1 and a matching document title. */
export function Page({ title, lead, children }: PageProps) {
  return (
    <>
      {/* React 19 hoists <title> into <head>. */}
      <title>{`${title} · City Parking`}</title>
      <div className="page-head">
        <h1 tabIndex={-1}>{title}</h1>
        {lead ? <p className="lead">{lead}</p> : null}
      </div>
      {children}
    </>
  );
}

/** Marks an area a later card fills in, so the shell can be reviewed before the features exist. */
export function Placeholder({ card, children }: { card: string; children: ReactNode }) {
  return (
    <section className="placeholder" aria-label={`Coming in card ${card}`}>
      <p className="placeholder__tag">Card {card}</p>
      <div>{children}</div>
    </section>
  );
}
