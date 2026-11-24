import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { daysUntil } from "../../lib/format.js";
import { serveMockApi } from "../../test/mockApi.js";
import { findHeading, renderApp } from "../../test/renderApp.js";

/** Card S1-09: fee breakdown on the results page. */

serveMockApi();

/** Freeze only the clock, so "in N days" is predictable; timers stay real for the mock API. */
function today(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(iso) });
}
afterEach(() => vi.useRealTimers());

const citation = (ticketNo: string) => screen.getByRole("article", { name: `Ticket ${ticketNo}` });

/** The fee rows of one citation as [label, value] pairs. */
const fees = (ticketNo: string) =>
  [...citation(ticketNo).querySelectorAll(".fees > div")].map((row) => [
    row.querySelector("dt")?.textContent,
    row.querySelector("dd")?.textContent,
  ]);

describe("results page fee breakdown (S1-09)", () => {
  beforeEach(() => today("2026-11-24T18:00:00Z"));

  it("shows the 2-citation fixture with correct amounts and dates", async () => {
    renderApp("/results?q=ABC1234&state=MO");
    await findHeading("2 open citations");

    expect(fees("T00012345")).toEqual([
      ["Base fine", "$40.00"],
      ["Late fees", "$15.00"],
      ["Total due", "$55.00"],
    ]);
    expect(within(citation("T00012345")).getByText("Issued Oct 2, 2026")).toBeTruthy();
    expect(
      within(citation("T00012345")).getByText("Goes up on Dec 2, 2026 (in 8 days)"),
    ).toBeTruthy();

    expect(fees("T00012346")).toEqual([
      ["Base fine", "$25.00"],
      ["Late fees", "None"],
      ["Total due", "$25.00"],
    ]);
    expect(within(citation("T00012346")).getByText("Issued Nov 10, 2026")).toBeTruthy();
    expect(
      within(citation("T00012346")).getByText("Goes up on Dec 10, 2026 (in 16 days)"),
    ).toBeTruthy();
  });

  it("totals all open citations and says each is paid separately", async () => {
    renderApp("/results?q=ABC1234&state=MO");
    await findHeading("2 open citations");
    const summary = screen.getByText(/Each citation is paid separately/);
    expect(summary.textContent).toContain("Total for all 2: $80.00.");
  });

  it("has one pay link per citation, going to that citation's checkout", async () => {
    renderApp("/results?q=ABC1234&state=MO");
    await findHeading("2 open citations");
    const link = within(citation("T00012346")).getByRole("link", {
      name: "Pay $25.00 for ticket T00012346",
    });
    expect(link.getAttribute("href")).toBe("/pay/5c0d7e1a-3b2f-4d6a-8e90-000000000002");
  });

  it("does not show a total line for a single citation", async () => {
    renderApp("/results?q=T00020001");
    await findHeading("1 open citation");
    expect(screen.queryByText(/Total for all/)).toBeNull();
  });
});

describe("increase warning", () => {
  it("highlights an increase within 7 days", async () => {
    today("2026-11-28T18:00:00Z");
    renderApp("/results?q=ABC1234&state=MO");
    await findHeading("2 open citations");
    const soon = within(citation("T00012345")).getByText("Goes up on Dec 2, 2026 (in 4 days)");
    expect(soon.classList.contains("increase--soon")).toBe(true);
    const later = within(citation("T00012346")).getByText(/Goes up on Dec 10/);
    expect(later.classList.contains("increase--soon")).toBe(false);
  });

  it("says 'tomorrow' the day before", async () => {
    today("2026-12-01T18:00:00Z");
    renderApp("/results?q=ABC1234&state=MO");
    await findHeading("2 open citations");
    expect(
      within(citation("T00012345")).getByText("Goes up on Dec 2, 2026 (tomorrow)"),
    ).toBeTruthy();
  });
});

describe("daysUntil", () => {
  it("counts calendar days in the city's time zone, not UTC", () => {
    // 11 pm in St. Louis on Dec 1 is already Dec 2 in UTC; the increase is still "tomorrow".
    expect(daysUntil("2026-12-02T06:00:00Z", new Date("2026-12-02T05:00:00Z"))).toBe(1);
    expect(daysUntil("2026-12-02T06:00:00Z", new Date("2026-12-02T06:30:00Z"))).toBe(0);
  });

  it("is not thrown off by the end of daylight saving time", () => {
    expect(daysUntil("2026-11-02T06:00:00Z", new Date("2026-10-31T17:00:00Z"))).toBe(2);
  });
});
