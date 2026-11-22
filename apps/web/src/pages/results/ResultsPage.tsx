import { Link, useLoaderData } from "react-router";
import { Page } from "../../components/Page.js";
import type { ResultsData } from "./loader.js";
import {
  ErrorView,
  FoundView,
  InvalidFormatView,
  NearMatchView,
  NoOpenCitationsView,
  UnknownIdentifierView,
} from "./outcomes.js";

/** One screen per lookup outcome (F1). */
export function ResultsPage() {
  const data = useLoaderData<ResultsData>();

  if (data.kind === "empty") {
    return (
      <Page title="No search entered">
        <p>
          <Link to="/">Search for a citation</Link> by ticket number, plate or VIN.
        </p>
      </Page>
    );
  }

  if (data.kind === "error") return <ErrorView code={data.code} q={data.q} state={data.state} />;

  const { result, q, state } = data;
  switch (result.outcome) {
    case "found":
      return <FoundView result={result} />;
    case "near_match":
      return <NearMatchView result={result} />;
    case "no_open_citations":
      return <NoOpenCitationsView result={result} />;
    case "unknown_identifier":
      return <UnknownIdentifierView result={result} />;
    case "invalid_format":
      return <InvalidFormatView reason={result.reason} q={q} state={state} />;
  }
}
