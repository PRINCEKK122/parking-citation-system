import { Link, useLocation } from "react-router";
import { Page } from "../components/Page.js";

export function NotFoundPage() {
  const { pathname } = useLocation();
  return (
    <Page title="Page not found">
      <p>
        There is no page at <span className="mono">{pathname}</span>. Check the address, or{" "}
        <Link to="/">find a citation</Link> from the start.
      </p>
    </Page>
  );
}
