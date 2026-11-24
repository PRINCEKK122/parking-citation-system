import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { paths } from "./paths.js";
import { serveMockApi } from "./test/mockApi.js";
import { findHeading, renderApp } from "./test/renderApp.js";

serveMockApi();

describe("routes", () => {
  it.each([
    [paths.lookup(), "Find your parking citation"],
    [paths.results("ABC1234", "MO"), "2 open citations"],
    ["/results", "No search entered"],
    [paths.checkout("5c0d7e1a-3b2f-4d6a-8e90-000000000001"), "Pay your citation"],
    [paths.paymentStatus("8d2e4b6a-1c3f-4e5d-a7b9-0c1d2e3f4a5b"), "Payment not found"],
    [paths.signIn(), "Sign in"],
    [paths.account(), "Sign in"], // guests are sent to sign in
    [paths.staff(), "Sign in"], // staff only; guests are sent to sign in
    ["/no/such/page", "Page not found"],
  ])("%s renders its page with a matching title", async (path, title) => {
    renderApp(path);
    await findHeading(title);
    await waitFor(() => expect(document.title).toBe(`${title} · City Parking`));
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("names the missing path on the 404 page", async () => {
    renderApp("/tickets/old-link");
    expect(await screen.findByText("/tickets/old-link")).toBeTruthy();
  });

  it("marks the current page in the main navigation", async () => {
    renderApp(paths.signIn());
    await findHeading("Sign in");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe("Sign in");
  });

  it("moves focus to the new heading after navigating", async () => {
    const { user } = renderApp(paths.lookup());
    await findHeading("Find your parking citation");
    await user.click(screen.getByRole("link", { name: "Sign in" }));
    const h1 = await findHeading("Sign in");
    expect(document.activeElement).toBe(h1);
  });

  it("offers a skip link to the main content", async () => {
    renderApp(paths.lookup());
    await findHeading();
    expect(screen.getByRole("link", { name: "Skip to main content" }).getAttribute("href")).toBe(
      "#main",
    );
    expect(document.getElementById("main")).toBeTruthy();
  });
});

describe("paths", () => {
  it("encodes search parameters and ids", () => {
    expect(paths.results("ABC 12", "MO")).toBe("/results?q=ABC+12&state=MO");
    expect(paths.results("T00012345")).toBe("/results?q=T00012345");
    expect(paths.checkout("a/b")).toBe("/pay/a%2Fb");
  });
});
