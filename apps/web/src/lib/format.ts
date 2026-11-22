import { US_STATES, type MatchedIdentifier } from "@pcs/shared";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatCents(cents: number): string {
  return usd.format(cents / 100);
}

const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export function formatDate(iso: string): string {
  return day.format(new Date(iso));
}

export function stateName(code: string | undefined): string | undefined {
  return US_STATES.find(([c]) => c === code)?.[1];
}

const KIND_NAMES = { ticket: "ticket", plate: "plate", vin: "VIN" } as const;

/** "plate ABC1234 (Missouri)", "VIN 1HGCM82633A004352", "ticket T00012345". */
export function describeIdentifier(id: MatchedIdentifier): string {
  const state = stateName(id.state);
  return `${KIND_NAMES[id.kind]} ${id.value}${state ? ` (${state})` : ""}`;
}

export function kindName(id: MatchedIdentifier): string {
  return KIND_NAMES[id.kind];
}
