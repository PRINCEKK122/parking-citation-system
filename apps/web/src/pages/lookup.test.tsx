import { describe, expect, it } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { invalidFormatMessages } from "@pcs/shared";
import { serveMockApi } from "../test/mockApi.js";
import { findHeading, renderApp } from "../test/renderApp.js";

/** Card S1-07: one search field, inline format errors, five distinct outcomes (F1, US1, T2). */

serveMockApi();

const field = () => screen.getByLabelText("Ticket number, license plate, or VIN");
const stateSelect = () => screen.getByLabelText(/Plate state/);

async function search(q: string, state?: string) {
  const app = renderApp("/");
  await findHeading("Find your parking citation");
  await app.user.type(field(), q);
  if (state) await app.user.selectOptions(stateSelect(), state);
  await app.user.click(screen.getByRole("button", { name: "Search" }));
  return app;
}

describe("inline format errors, before any request", () => {
  it("shows a check-digit error for a mistyped VIN and stays on the search page", async () => {
    const { router } = await search("1HGCM82643A004352");
    expect(await screen.findByText(invalidFormatMessages.check_digit)).toBeTruthy();
    expect(router.state.location.pathname).toBe("/");
    expect(field().getAttribute("aria-invalid")).toBe("true");
    expect(field().getAttribute("aria-describedby")).toContain(
      screen.getByText(invalidFormatMessages.check_digit).id,
    );
    expect(document.activeElement).toBe(field());
  });

  it("flags a 16-character VIN as the wrong length (US1)", async () => {
    await search("1HGCM82633A00435");
    expect(await screen.findByText(invalidFormatMessages.length)).toBeTruthy();
  });

  it("asks for the state when a plate has none, and moves focus to the state field", async () => {
    await search("ABC1234");
    expect(await screen.findByText(invalidFormatMessages.missing_state)).toBeTruthy();
    expect(stateSelect().getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(stateSelect());
  });

  it("clears the error as soon as the entry is fixed", async () => {
    const { user } = await search("ABC1234");
    await screen.findByText(invalidFormatMessages.missing_state);
    await user.selectOptions(stateSelect(), "MO");
    expect(screen.queryByText(invalidFormatMessages.missing_state)).toBeNull();
  });

  it("says what kind of identifier the input looks like while typing", async () => {
    const { user } = renderApp("/");
    await findHeading();
    await user.type(field(), "1hgcm 8263 3a00 4352");
    expect(screen.getByText("Looks like a VIN.")).toBeTruthy();
    await user.clear(field());
    await user.type(field(), "T-00012345");
    expect(screen.getByText("Looks like a ticket number.")).toBeTruthy();
  });
});

describe("the five outcomes each have their own screen", () => {
  it("found: lists the open citations with a pay link for each", async () => {
    await search("abc 1234", "MO");
    await findHeading("2 open citations");
    expect(screen.getByText("Citations found")).toBeTruthy();
    const items = screen.getAllByRole("listitem").filter((li) => li.classList.contains("citation"));
    expect(items.map((li) => within(li).getByText(/^T\d+$/).textContent)).toEqual([
      "T00012345",
      "T00012346",
    ]);
    expect(screen.getByRole("link", { name: "Pay $55.00 for ticket T00012345" })).toBeTruthy();
  });

  it("near match: highlights the corrected character and shows nothing until confirmed", async () => {
    const { user } = await search("A8C1234", "MO");
    await findHeading("Did you mean ABC1234?");
    expect(screen.getByText("Possible typo")).toBeTruthy();
    const marks = document.querySelectorAll(".highlight mark");
    expect([...marks].map((m) => m.textContent)).toEqual(["B (corrected)"]);
    expect(screen.queryByText("T00012345")).toBeNull();

    await user.click(screen.getByRole("link", { name: "Yes, show citations for ABC1234" }));
    await findHeading("2 open citations");
  });

  it("near match: 'No' goes back to the search with the entry kept", async () => {
    const { user } = await search("A8C1234", "MO");
    await findHeading("Did you mean ABC1234?");
    await user.click(screen.getByRole("link", { name: "No, change what I entered" }));
    await findHeading("Find your parking citation");
    expect((field() as HTMLInputElement).value).toBe("A8C1234");
    expect((stateSelect() as HTMLSelectElement).value).toBe("MO");
  });

  it("no open citations: says the vehicle is known and owes nothing", async () => {
    await search("XYZ789", "IL");
    await findHeading("Nothing to pay");
    expect(screen.getByText(/We found plate XYZ789 \(Illinois\)/)).toBeTruthy();
  });

  it("unknown identifier: says it is not on file, which is not the same as no tickets", async () => {
    await search("QQQ999", "MO");
    await findHeading("We have no record of this plate");
    expect(screen.getByText(/does/).textContent).toContain("not mean you have no tickets");
    expect((field() as HTMLInputElement).value).toBe("QQQ999");
  });

  it("invalid format from the server (e.g. an edited URL) shows the reason and the form", async () => {
    renderApp("/results?q=1HGCM82643A004352");
    await findHeading("Check what you entered");
    expect(screen.getAllByText(invalidFormatMessages.check_digit).length).toBeGreaterThan(0);
    expect(field().getAttribute("aria-invalid")).toBe("true");
  });

  it("gives each outcome a different heading", async () => {
    const headings = new Set<string>();
    for (const path of [
      "/results?q=ABC1234&state=MO",
      "/results?q=A8C1234&state=MO",
      "/results?q=XYZ789&state=IL",
      "/results?q=QQQ999&state=MO",
      "/results?q=1HGCM82643A004352",
    ]) {
      renderApp(path);
      headings.add((await findHeading()).textContent ?? "");
      cleanup();
    }
    expect(headings.size).toBe(5);
  });
});

describe("when the search itself fails", () => {
  it("explains the rate limit", async () => {
    await search("RATELIM", "MO");
    await findHeading("Too many searches");
  });

  it("offers to try again after a server error", async () => {
    await search("ERROR500", "MO");
    await findHeading("The search didn’t finish");
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});
