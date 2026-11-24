# Parking Citation System

An error-tolerant, failure-resilient web system for looking up and paying municipal parking
citations. CSCI 5360 Web Technologies, Fall 2026, Red Track project by Prince Karikari.

It fixes two problems found in a heuristic evaluation of the City of St. Louis portal:

- **Lookup:** a typo, an unknown identifier and a vehicle with no open tickets all returned
  "No Tickets Found". This system returns five distinct outcomes and recovers likely typos.
- **Payment:** one card error cleared the whole form, and retries were not safe. This system keeps
  the form and charges each citation exactly once, even with retries, double-clicks and gateway faults.

All data is synthetic and all cards are test cards. Not affiliated with any city.

## Repository layout

| Path              | What it is                                                             |
| ----------------- | ---------------------------------------------------------------------- |
| `apps/web`        | React + TypeScript frontend (Vite)                                     |
| `apps/api`        | REST API (Express): lookup, payments, auth, staff                      |
| `apps/worker`     | BullMQ charge worker and reconciler                                    |
| `apps/gateway`    | Simulated payment gateway with fault injection                         |
| `packages/shared` | Zod schemas and types shared by web and API (one source of validation) |

## Requirements

- Node.js 24 LTS (see `.nvmrc`; 22 also works)
- Docker, for Postgres 17 and Redis 7

## Getting started

```bash
cp .env.example .env
npm install
npm run dev:services   # starts Postgres and Redis, waits until healthy
npm run dev            # web app at http://localhost:5173
npm run dev:api        # API at http://localhost:4000/health
```

## Running the frontend without a backend

With `VITE_USE_MOCKS=true` (the default in `.env.example`), a service worker in the browser
answers every `/api` and gateway call from synthetic data, so the whole UI works with no API,
database or gateway running. The footer says when mocks are on. The handlers live in
`apps/web/src/mocks/` and the tests check every mocked response against the shared schemas.

| To see                          | Enter                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `found`                         | `ABC1234` + MO (2 citations), VIN `1HGCM82633A004352`, or `T00012345`        |
| `near_match`                    | `A8C1234` + MO (suggests ABC1234)                                            |
| `no_open_citations`             | `XYZ789` + IL, or VIN `1M8GDM9AXKP042788`                                    |
| `unknown_identifier`            | any other valid input, e.g. `QQQ999` + MO                                    |
| `invalid_format`                | `1HGCM82643A004352` (check digit), a 16-character VIN, a plate with no state |
| 429 / 500                       | `RATELIM` + MO / `ERROR500` + MO                                             |
| 409 `amount_changed` at payment | `FEE2026` + MO (a late fee lands between lookup and payment)                 |

| Test card          | Result                          |
| ------------------ | ------------------------------- |
| `4242424242424242` | Succeeds after two status polls |
| `4000000000000002` | Declined                        |
| `4000000000000119` | Gateway error                   |
| `4000000000000077` | Succeeds after six polls        |

Any future expiry date and any 3-digit CVC work. Accounts: `resident@example.com` /
`resident-pass-123` and `staff@example.com` / `staff-pass-1234`. Ticket `T00030001` is already
paid online, so the staff console won't offer to record a payment for it. To see the 409 from user
story US3, search `T00050001` in the staff console and record a check: the mock pays it online at
that moment, as if a resident beat the clerk to it.

## Preview deploy (frontend with mock data)

`netlify.toml` builds `apps/web` with the mock API on, so the whole UI runs as a static site with
no backend. To set it up once: in Netlify, choose **Add new site → Import an existing project**,
pick this GitHub repository, and keep the settings it reads from `netlify.toml`. Every push to
`main` then redeploys. The end-to-end tests run against the same build settings.

## Scripts

| Command                 | Does                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `npm run check`         | Format check, lint, typecheck and tests (as CI)                                                                    |
| `npm run build`         | Builds every workspace                                                                                             |
| `npm test`              | Unit tests in every workspace                                                                                      |
| `npm run e2e`           | Playwright end-to-end tests (T3, T4) on a production build with mocks; first run `npx playwright install chromium` |
| `npm run format`        | Rewrites files with Prettier                                                                                       |
| `npm run stop:services` | Stops Postgres and Redis (data volumes are kept)                                                                   |

CI runs the same checks plus the build on every push to `main` and on pull requests.
