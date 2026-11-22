import { setupWorker } from "msw/browser";
import { config } from "../config.js";
import { createMockApi } from "./handlers.js";

const SESSION_KEY = "pcs.mock.session";

/** Keep the mock sign-in across reloads in this tab. Storage can be blocked, so fail soft. */
const session = {
  get(): string | null {
    try {
      return sessionStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  },
  set(userId: string | null) {
    try {
      if (userId) sessionStorage.setItem(SESSION_KEY, userId);
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Ignore: the session just won't survive a reload.
    }
  },
};

export async function startMockApi() {
  const { handlers } = createMockApi({ gatewayUrl: config.gatewayUrl, session });
  const worker = setupWorker(...handlers);
  await worker.start({
    onUnhandledFrame: "bypass",
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    quiet: true,
  });
  console.info("[mocks] Mock API is on. Set VITE_USE_MOCKS=false to use the real API.");
}
