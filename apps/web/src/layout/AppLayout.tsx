import { useEffect, useRef } from "react";
import { Form, Link, NavLink, Outlet, useLocation } from "react-router";
import type { SessionUser } from "@pcs/shared";
import { config } from "../config.js";
import { useSessionUser } from "../session.js";

/** Navigation depends on who is signed in: guests, residents and staff each see their own. */
function navFor(user: SessionUser | null) {
  if (user?.role === "staff") return [{ to: "/staff", label: "Staff console", end: false }];
  const find = { to: "/", label: "Find a citation", end: true };
  if (user?.role === "resident") return [find, { to: "/account", label: "My account", end: false }];
  return [find, { to: "/sign-in", label: "Sign in", end: false }];
}

/**
 * Header, main region and footer shared by every page. After each client-side navigation,
 * focus moves to the new page's heading so screen readers announce it (a full page load
 * would do this on its own; an SPA has to do it by hand).
 */
export function AppLayout() {
  const location = useLocation();
  const user = useSessionUser();
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.querySelector<HTMLElement>("h1")?.focus();
  }, [location.key]);

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="site-header">
        <div className="container site-header__inner">
          <Link to="/" className="brand">
            <span className="brand__mark" aria-hidden="true">
              P
            </span>
            <span>
              City Parking <span className="brand__sub">Citations</span>
            </span>
          </Link>
          <nav aria-label="Main">
            <ul className="nav">
              {navFor(user).map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.end} className="nav__link">
                    {item.label}
                  </NavLink>
                </li>
              ))}
              {user ? (
                <li>
                  <Form method="post" action="/sign-out">
                    <button type="submit" className="nav__link nav__button">
                      Sign out
                    </button>
                  </Form>
                </li>
              ) : null}
            </ul>
          </nav>
        </div>
      </header>

      <main id="main" ref={mainRef} className="container main" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container">
          <p>
            Demonstration system for CSCI 5360. All citations are synthetic and only test cards are
            accepted. Not affiliated with any city.
          </p>
          {config.useMocks ? (
            <p className="mock-note">
              Running on mock data in your browser; nothing is sent to a server.
            </p>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
