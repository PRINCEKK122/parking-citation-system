import { US_STATES, type MatchedIdentifier } from "@pcs/shared";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatCents(cents: number): string {
  return usd.format(cents / 100);
}

/** Dates are shown in the city's time zone, so a fee that goes up at local midnight shows the right day. */
export const CITY_TIME_ZONE = "America/Chicago";

const day = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: CITY_TIME_ZONE,
});

export function formatDate(iso: string): string {
  return day.format(new Date(iso));
}

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: CITY_TIME_ZONE }); // YYYY-MM-DD

/** Whole calendar days from `now` until `iso`, counted in the city's time zone. */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const toUtcMidnight = (d: Date) => Date.parse(`${dayKey.format(d)}T00:00:00Z`);
  return Math.round((toUtcMidnight(new Date(iso)) - toUtcMidnight(now)) / 86_400_000);
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
