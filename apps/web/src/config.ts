/** Browser-side settings. Vite inlines VITE_* variables at build time. */
export const config = {
  /** Serve /api and gateway calls from in-browser mocks (MSW) instead of real services. */
  useMocks: import.meta.env.VITE_USE_MOCKS === "true",
  /** The simulated gateway, which the browser calls directly to turn a card into a token. */
  gatewayUrl: (import.meta.env.VITE_GATEWAY_URL as string | undefined) ?? "http://localhost:4100",
};
