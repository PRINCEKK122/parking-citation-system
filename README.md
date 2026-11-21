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

## Scripts

| Command                 | Does                                             |
| ----------------------- | ------------------------------------------------ |
| `npm run check`         | Format check, lint, typecheck and tests (as CI)  |
| `npm run build`         | Builds every workspace                           |
| `npm test`              | Unit tests in every workspace                    |
| `npm run format`        | Rewrites files with Prettier                     |
| `npm run stop:services` | Stops Postgres and Redis (data volumes are kept) |

CI runs the same checks plus the build on every push to `main` and on pull requests.
