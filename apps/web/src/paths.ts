/** URL builders, so pages never hand-assemble paths. */
export const paths = {
  lookup: () => "/",
  results: (q: string, state?: string) =>
    `/results?${new URLSearchParams(state ? { q, state } : { q }).toString()}`,
  checkout: (citationId: string) => `/pay/${encodeURIComponent(citationId)}`,
  paymentStatus: (paymentId: string) => `/payments/${encodeURIComponent(paymentId)}`,
  signIn: () => "/sign-in",
  account: () => "/account",
  staff: () => "/staff",
};
