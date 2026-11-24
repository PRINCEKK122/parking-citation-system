/**
 * Wait between status checks: quick at first, then backing off to every 5 s. A mutable object
 * so tests can shorten it.
 */
export const polling = { delaysMs: [1000, 1500, 2000, 3000, 5000] };
