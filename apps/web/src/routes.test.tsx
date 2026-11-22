import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { paths, routes } from "./routes.js";

afterEach(cleanup);

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const heading = () => screen.getByRole("heading", { level: 1 });

describe("routes", () => {
  it.each([
    [paths.lookup(), "Find your parking citation"],
    [paths.results("ABC1234", "MO"), "Open citations"],
    [paths.checkout("3f1c2a9e-8b4d-4c3a-9f2e-1a2b3c4d5e6f"), "Pay your citation"],
    [paths.paymentStatus("8d2e4b6a-1c3f-4e5d-a7b9-0c1d2e3f4a5b"), "Payment status"],
    [paths.signIn(), "Sign in"],
    [paths.account(), "Your account"],
    [paths.staff(), "Staff console"],
    ["/no/such/page", "Page not found"],
  ])("%s renders its page with a matching title", async (path, title) => {
    renderAt(path);
    expect(heading().textContent).toBe(title);
    await waitFor(() => expect(document.title).toBe(`${title} · City Parking`));
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("shows the searched identifier and state on the results page", () => {
    renderAt(paths.results("ABC1234", "MO"));
    expect(screen.getByText("ABC1234")).toBeTruthy();
    expect(document.body.textContent).toContain("(MO)");
  });

  it("asks for a search when results are opened without one", () => {
    renderAt("/results");
    expect(heading().textContent).toBe("No search entered");
  });

  it("names the missing path on the 404 page", () => {
    renderAt("/tickets/old-link");
    expect(screen.getByText("/tickets/old-link")).toBeTruthy();
  });

  it("marks the current page in the main navigation", () => {
    renderAt(paths.signIn());
    const nav = screen.getByRole("navigation", { name: "Main" });
    const current = nav.querySelector('[aria-current="page"]');
    expect(current?.textContent).toBe("Sign in");
  });

  it("moves focus to the new heading after navigating", async () => {
    const user = userEvent.setup();
    renderAt(paths.lookup());
    await user.click(screen.getByRole("link", { name: "Sign in" }));
    await waitFor(() => expect(heading().textContent).toBe("Sign in"));
    expect(document.activeElement).toBe(heading());
  });

  it("offers a skip link to the main content", () => {
    renderAt(paths.lookup());
    const skip = screen.getByRole("link", { name: "Skip to main content" });
    expect(skip.getAttribute("href")).toBe("#main");
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
