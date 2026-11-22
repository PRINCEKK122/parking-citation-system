import { useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { config } from "../config.js";

const NAV = [
  { to: "/", label: "Find a citation", end: true },
  { to: "/sign-in", label: "Sign in", end: false },
];

/**
 * Header, main region and footer shared by every page. After each client-side navigation,
 * focus moves to the new page's heading so screen readers announce it (a full page load
 * would do this on its own; an SPA has to do it by hand).
 */
export function AppLayout() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.querySelector<HTMLElement>("h1")?.focus();
  }, [location.pathname]);

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
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.end} className="nav__link">
                    {item.label}
                  </NavLink>
                </li>
              ))}
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
