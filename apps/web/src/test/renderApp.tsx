import { afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { routes } from "../routes.js";

afterEach(cleanup);

/** Render the whole app at a URL, as a user would land on it. */
export function renderApp(path = "/") {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const user = userEvent.setup();
  render(<RouterProvider router={router} />);
  return { router, user };
}

/** The page's one h1, once it has rendered (loaders may still be running before that). */
export const findHeading = (text?: string | RegExp) =>
  text === undefined
    ? screen.findByRole("heading", { level: 1 })
    : screen.findByRole("heading", { level: 1, name: text });
