import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { paths } from "../paths.js";
import { findHeading, renderApp } from "./renderApp.js";

/** Helpers for tests that go through checkout. */

export const CITATION = "5c0d7e1a-3b2f-4d6a-8e90-000000000001"; // T00012345, $55.00

export const input = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement;
export const payButton = () => screen.getByRole("button", { name: /^Pay \$/ });

export async function open(citationId = CITATION) {
  const app = renderApp(paths.checkout(citationId));
  await findHeading("Pay your citation");
  return app;
}

export async function fillPayer(user: UserEvent) {
  await user.type(input("Name on the card"), "Jordan Lee");
  await user.type(input("Email"), "jordan@example.com");
  await user.type(input("Street address"), "1200 Market St");
  await user.type(input("City"), "St. Louis");
  await user.type(screen.getByRole("combobox", { name: "State" }), "MO");
  await user.tab();
  await user.type(input("ZIP code"), "63103");
}

export async function fillCard(user: UserEvent, number = "4242 4242 4242 4242", expiry = "12/30") {
  await user.type(input("Card number"), number);
  await user.type(input("Expiry (MM/YY)"), expiry);
  await user.type(input("Security code"), "123");
}
