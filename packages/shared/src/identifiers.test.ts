import { describe, expect, it } from "vitest";
import { classifyIdentifier, isValidVin, normalizeVin, vinCheckDigit } from "./identifiers.js";

// Published sample VINs with correct check digits (the second has check digit X).
const VALID_VIN = "1HGCM82633A004352";
const VALID_VIN_X = "1M8GDM9AXKP042788";

describe("VIN check digit (49 CFR 565.15)", () => {
  it("accepts VINs with a correct check digit, including X", () => {
    expect(isValidVin(VALID_VIN)).toBe(true);
    expect(isValidVin(VALID_VIN_X)).toBe(true);
    expect(vinCheckDigit(VALID_VIN_X)).toBe("X");
  });

  it("rejects a VIN whose check digit is wrong", () => {
    expect(isValidVin("1HGCM82643A004352")).toBe(false);
  });

  it("returns null for characters a VIN cannot contain", () => {
    expect(vinCheckDigit("1HGCM82633A00435O")).toBeNull();
  });

  it("reads I, O and Q as 1, 0, 0", () => {
    expect(normalizeVin("1hgcm82633a0o4352")).toBe(VALID_VIN);
    expect(normalizeVin("IHGCM82633AQ04352")).toBe(VALID_VIN);
  });
});

describe("classifyIdentifier", () => {
  it("recognizes a ticket number with or without a dash", () => {
    expect(classifyIdentifier("T-00012345")).toEqual({
      ok: true,
      kind: "ticket",
      value: "T00012345",
    });
    expect(classifyIdentifier(" t00012345 ")).toMatchObject({ ok: true, kind: "ticket" });
  });

  it("recognizes a VIN typed with spaces, lowercase and an O for a zero", () => {
    expect(classifyIdentifier("1hgcm 8263 3a0o 4352")).toEqual({
      ok: true,
      kind: "vin",
      value: VALID_VIN,
    });
  });

  it("recognizes a plate when a state is given", () => {
    expect(classifyIdentifier("abc 1234", "MO")).toEqual({
      ok: true,
      kind: "plate",
      value: "ABC1234",
      state: "MO",
    });
  });

  it("returns a distinct reason for each kind of bad input", () => {
    const reason = (raw: string, state?: "MO") => {
      const r = classifyIdentifier(raw, state);
      return r.ok ? null : r.reason;
    };
    expect(reason("   ")).toBe("empty");
    expect(reason("ABC#123", "MO")).toBe("characters");
    expect(reason(VALID_VIN.slice(0, 16))).toBe("length"); // US1: 16-character VIN
    expect(reason("T0001234567")).toBe("length"); // ticket with too many digits
    expect(reason("A")).toBe("length");
    expect(reason("1HGCM82643A004352")).toBe("check_digit"); // T2
    expect(reason("ABC1234")).toBe("missing_state");
  });
});
