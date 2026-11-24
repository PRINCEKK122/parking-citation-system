import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { serveMockApi } from "../../test/mockApi.js";
import { findHeading, renderApp } from "../../test/renderApp.js";

/** Card S1-12: sign in, register, and the resident account page (F3). */

serveMockApi();

const nav = () => screen.getByRole("navigation", { name: "Main" });
const navLabels = () =>
  within(nav())
    .getAllByRole("listitem")
    .map((li) => li.textContent);

async function signIn(user: UserEvent, email: string, password: string) {
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

async function signInAsResident(path = "/sign-in") {
  const app = renderApp(path);
  await findHeading("Sign in");
  await signIn(app.user, "resident@example.com", "resident-pass-123");
  await findHeading("Your account");
  return app;
}

describe("sign in", () => {
  it("sends a guest who opens the account page to sign in, then back to the account", async () => {
    const { router } = renderApp("/account");
    await findHeading("Sign in");
    expect(router.state.location.search).toBe("?next=%2Faccount");
    expect(navLabels()).toEqual(["Find a citation", "Sign in"]);
  });

  it("checks the fields before contacting the server", async () => {
    const { user } = renderApp("/sign-in");
    await findHeading("Sign in");
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter the email address you registered with.")).toBeTruthy();
    expect(screen.getByText("Enter your password.")).toBeTruthy();
  });

  it("explains a wrong password and keeps the email", async () => {
    const { user } = renderApp("/sign-in");
    await findHeading("Sign in");
    await signIn(user, "resident@example.com", "wrong-password");
    expect((await screen.findByRole("alert")).textContent).toContain("don’t match an account");
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("resident@example.com");
    expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("");
  });

  it("takes a resident to their account and changes the navigation", async () => {
    await signInAsResident();
    expect(navLabels()).toEqual(["Find a citation", "My account", "Sign out"]);
    expect(screen.getByText("Signed in as resident@example.com.")).toBeTruthy();
  });

  it("takes staff to the staff console, and keeps staff out of the resident account", async () => {
    const { user, router } = renderApp("/sign-in");
    await findHeading("Sign in");
    await signIn(user, "staff@example.com", "staff-pass-1234");
    await waitFor(() => expect(router.state.location.pathname).toBe("/staff"));
    expect(navLabels()).toEqual(["Staff console", "Sign out"]);
    await router.navigate("/account");
    await waitFor(() => expect(router.state.location.pathname).toBe("/staff"));
  });

  it("ignores a next= that points to another site", async () => {
    const { user, router } = renderApp("/sign-in?next=//evil.example.com/");
    await findHeading("Sign in");
    await signIn(user, "resident@example.com", "resident-pass-123");
    await waitFor(() => expect(router.state.location.pathname).toBe("/account"));
  });

  it("signs out", async () => {
    const { user, router } = await signInAsResident();
    await user.click(within(nav()).getByRole("button", { name: "Sign out" }));
    await findHeading("Find your parking citation");
    expect(navLabels()).toEqual(["Find a citation", "Sign in"]);
    await router.navigate("/account");
    await findHeading("Sign in");
  });
});

describe("register", () => {
  it("creates a resident account and starts with empty lists", async () => {
    const { user } = renderApp("/register");
    await findHeading("Create an account");
    await user.type(screen.getByLabelText("Email"), "new.driver@example.com");
    await user.type(screen.getByLabelText("Password"), "correct horse battery");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await findHeading("Your account");
    expect(screen.getByText(/No saved vehicles yet/)).toBeTruthy();
    expect(screen.getByText(/Payments you make while signed in will appear here/)).toBeTruthy();
  });

  it("asks for a longer password, and points an existing email to sign in", async () => {
    const { user } = renderApp("/register");
    await findHeading("Create an account");
    await user.type(screen.getByLabelText("Email"), "resident@example.com");
    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Use at least 12 characters.")).toBeTruthy();

    await user.type(screen.getByLabelText("Password"), " but now long enough");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect((await screen.findByRole("alert")).textContent).toContain("already an account");
    expect(screen.getByRole("link", { name: "Sign in instead" })).toBeTruthy();
  });
});

describe("account page", () => {
  it("lists saved vehicles and payment history", async () => {
    await signInAsResident();
    expect(screen.getByText("My car")).toBeTruthy();
    expect(screen.getByText("plate ABC1234 (Missouri)")).toBeTruthy();
    const row = screen.getByRole("row", { name: /T00030001/ });
    expect(row.textContent).toContain("$40.00");
    expect(row.textContent).toContain("Paid");
    expect(within(row).getByRole("link", { name: "T00030001" }).getAttribute("href")).toMatch(
      /^\/payments\//,
    );
  });

  it("acceptance: add a vehicle, then look it up in one tap", async () => {
    const { user } = await signInAsResident();
    await user.type(screen.getByLabelText("Name"), "Work truck");
    await user.type(screen.getByLabelText("License plate or VIN"), "1hgcm82633a004352");
    await user.click(screen.getByRole("button", { name: "Save vehicle" }));

    const lookUp = await screen.findByRole("link", { name: "Look up citations for Work truck" });
    expect(screen.getByText("VIN 1HGCM82633A004352")).toBeTruthy();
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(""); // form reset

    await user.click(lookUp);
    await findHeading("1 open citation");
  });

  it("saves a plate with its state from the combo box", async () => {
    const { user } = await signInAsResident();
    await user.type(screen.getByLabelText("Name"), "Spouse’s car");
    await user.type(screen.getByLabelText("License plate or VIN"), "XYZ789");
    await user.type(screen.getByRole("combobox", { name: /Plate state/ }), "IL");
    await user.tab();
    await user.click(screen.getByRole("button", { name: "Save vehicle" }));
    expect(await screen.findByText("plate XYZ789 (Illinois)")).toBeTruthy();
  });

  it("explains a missing state, a ticket number, and a missing name", async () => {
    const { user } = await signInAsResident();
    await user.type(screen.getByLabelText("License plate or VIN"), "ABC1234");
    await user.click(screen.getByRole("button", { name: "Save vehicle" }));
    expect(await screen.findByText("Choose the state on the license plate.")).toBeTruthy();
    expect(screen.getByText("Give the vehicle a name, like “My car”.")).toBeTruthy();

    await user.clear(screen.getByLabelText("License plate or VIN"));
    await user.type(screen.getByLabelText("License plate or VIN"), "T00012345");
    await user.click(screen.getByRole("button", { name: "Save vehicle" }));
    expect(await screen.findByText(/A ticket number belongs to one citation/)).toBeTruthy();
  });
});
