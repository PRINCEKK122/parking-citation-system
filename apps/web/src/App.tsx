import { lookupOutcomes } from "@pcs/shared";

/** Placeholder home screen. Routing and real pages arrive with card S1-05. */
export function App() {
  return (
    <main className="shell">
      <p className="eyebrow">City Parking · Demo system, not affiliated with any city</p>
      <h1>Pay a parking citation</h1>
      <p>
        Workspace is running. The lookup will distinguish {lookupOutcomes.length} outcomes instead
        of one “No Tickets Found”.
      </p>
    </main>
  );
}
