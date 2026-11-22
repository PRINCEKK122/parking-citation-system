import { useSearchParams } from "react-router";
import { Page } from "../components/Page.js";
import { SearchForm } from "../components/SearchForm.js";

export function LookupPage() {
  // "Change what I entered" links back here with the last search filled in.
  const [params] = useSearchParams();
  return (
    <Page
      title="Find your parking citation"
      lead="Search with your ticket number, your license plate and state, or your vehicle’s VIN."
    >
      <SearchForm
        key={params.toString()}
        defaultQuery={params.get("q") ?? ""}
        defaultState={params.get("state") ?? ""}
      />
    </Page>
  );
}
