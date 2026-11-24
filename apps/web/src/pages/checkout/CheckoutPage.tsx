import { Link, useLoaderData, useLocation } from "react-router";
import { Page } from "../../components/Page.js";
import { CheckoutForm } from "./CheckoutForm.js";
import type { CheckoutData } from "./loader.js";

export function CheckoutPage() {
  const data = useLoaderData<CheckoutData>();
  const location = useLocation();

  if (data.kind === "error") {
    return data.code === "not_found" ? (
      <Page title="Citation not found" lead="This payment link doesn’t match a citation.">
        <p>
          <Link to="/">Search for your citation</Link> by ticket number, plate or VIN.
        </p>
      </Page>
    ) : (
      <Page
        title="Checkout didn’t load"
        lead="We couldn’t load this citation. Nothing has been charged."
      >
        <p>
          Reload the page to try again, or <Link to="/">start a new search</Link>.
        </p>
      </Page>
    );
  }

  if (!data.payable) {
    return (
      <Page
        title="This citation can’t be paid now"
        lead={`Ticket ${data.citation.ticketNo} is already paid, or a payment for it is still being processed.`}
      >
        <p>
          Nothing more is due on it. <Link to="/">Search for another citation</Link>.
        </p>
      </Page>
    );
  }

  // A fresh form, and so a fresh idempotency key, for each visit to checkout: arriving back
  // after a declined card starts a new attempt, restoring the payer's details from the draft.
  // Reloading the data (e.g. after amount_changed) keeps the same form.
  return <CheckoutForm key={`${data.citation.id}:${location.key}`} citation={data.citation} />;
}
