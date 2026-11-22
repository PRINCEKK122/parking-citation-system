import { Link, useSearchParams } from "react-router";
import { Page, Placeholder } from "../components/Page.js";

export function ResultsPage() {
  const [params] = useSearchParams();
  const q = params.get("q")?.trim();
  const state = params.get("state");

  if (!q) {
    return (
      <Page title="No search entered">
        <p>
          <Link to="/">Search for a citation</Link> by ticket number, plate or VIN.
        </p>
      </Page>
    );
  }

  return (
    <Page
      title="Open citations"
      lead={
        <>
          Results for <span className="mono">{q}</span>
          {state ? ` (${state})` : null}. <Link to="/">Search again</Link>
        </>
      }
    >
      <Placeholder card="S1-09">
        Each open citation with ticket number, issue date, base fine, late fees, total, and the date
        the amount next goes up.
      </Placeholder>
    </Page>
  );
}
