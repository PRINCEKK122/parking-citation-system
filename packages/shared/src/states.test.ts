import { describe, expect, it } from "vitest";
import { US_STATES, matchStates } from "./states.js";

describe("matchStates", () => {
  it("puts the exact USPS code first: MO is Missouri, not Montana", () => {
    expect(matchStates("MO")[0]).toEqual({ code: "MO", name: "Missouri" });
    expect(matchStates("mo")[0]?.code).toBe("MO");
  });

  it("matches name prefixes before substrings", () => {
    const codes = matchStates("new").map((s) => s.code);
    expect(codes.slice(0, 4).sort()).toEqual(["NH", "NJ", "NM", "NY"]);
  });

  it("returns every state for an empty query", () => {
    expect(matchStates("  ")).toHaveLength(US_STATES.length);
  });

  it("returns nothing for a query that matches no state", () => {
    expect(matchStates("zz")).toEqual([]);
  });
});
