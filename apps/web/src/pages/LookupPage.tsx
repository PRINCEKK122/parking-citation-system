import { lookupOutcomes } from "@pcs/shared";
import { Page, Placeholder } from "../components/Page.js";

export function LookupPage() {
  return (
    <Page
      title="Find your parking citation"
      lead="Search with your ticket number, your license plate and state, or your vehicle's VIN."
    >
      <Placeholder card="S1-07">
        One search field with inline format errors. Every search ends in one of{" "}
        {lookupOutcomes.length} clearly different results, never a bare “No Tickets Found”.
      </Placeholder>
    </Page>
  );
}
