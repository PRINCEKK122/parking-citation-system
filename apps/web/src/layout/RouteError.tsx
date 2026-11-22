import { Link, isRouteErrorResponse, useRouteError } from "react-router";

/** Shown when a page throws while rendering. Stands alone, since the layout may be what broke. */
export function RouteError() {
  const error = useRouteError();
  if (!isRouteErrorResponse(error)) console.error(error);

  return (
    <main id="main" className="container main">
      <title>Something went wrong · City Parking</title>
      <h1>Something went wrong</h1>
      <p>
        This page could not be shown. Nothing has been charged. Go back to{" "}
        <Link to="/">find a citation</Link> and try again.
      </p>
    </main>
  );
}
