import { afterAll, beforeAll, beforeEach } from "vitest";
import { setupServer } from "msw/node";
import { config } from "../config.js";
import { createMockApi } from "../mocks/handlers.js";

/**
 * Serve the mock API to tests in this file, with fresh data for each test. Any request no
 * handler covers fails the test, so nothing silently reaches the network.
 */
export function serveMockApi() {
  const server = setupServer();
  let api: ReturnType<typeof createMockApi> | undefined;

  beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
  beforeEach(() => {
    api = createMockApi({ gatewayUrl: config.gatewayUrl });
    server.resetHandlers(...api.handlers);
  });
  afterAll(() => server.close());

  return {
    server,
    get db() {
      if (!api) throw new Error("serveMockApi: db is only available inside a test");
      return api.db;
    },
  };
}
