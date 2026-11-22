/** Shown while the first page's data loads, e.g. when a results link is opened directly. */
export function AppLoading() {
  return (
    <main id="main" className="container main" aria-busy="true">
      <p className="meta" role="status">
        Loading…
      </p>
    </main>
  );
}
