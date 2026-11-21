/** US states and DC with USPS codes, for the plate-state picker (test T3). */
export const US_STATES = [
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["DC", "District of Columbia"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
] as const satisfies ReadonlyArray<readonly [string, string]>;

export type StateCode = (typeof US_STATES)[number][0];

/**
 * Rank states for a typed query: exact code match first ("MO" -> Missouri, not Montana),
 * then names starting with the query, then names containing it.
 */
export function matchStates(query: string): Array<{ code: StateCode; name: string }> {
  const q = query.trim().toLowerCase();
  const all = US_STATES.map(([code, name]) => ({ code, name }));
  if (!q) return all;
  const rank = (s: { code: string; name: string }): number => {
    const name = s.name.toLowerCase();
    if (s.code.toLowerCase() === q) return 0;
    if (name.startsWith(q)) return 1;
    if (name.includes(q)) return 2;
    return 3;
  };
  return all
    .map((s) => ({ s, r: rank(s) }))
    .filter(({ r }) => r < 3)
    .sort((a, b) => a.r - b.r || a.s.name.localeCompare(b.s.name))
    .map(({ s }) => s);
}
