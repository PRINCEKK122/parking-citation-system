import { redirect, useRouteLoaderData, type ShouldRevalidateFunction } from "react-router";
import type { SessionUser, UserRole } from "@pcs/shared";
import { getSession } from "./api/client.js";

export const ROOT_ROUTE_ID = "root";

export interface RootData {
  user: SessionUser | null;
}

/** Who is signed in. A failed check counts as a guest rather than breaking every page. */
export async function rootLoader(): Promise<RootData> {
  try {
    return { user: await getSession() };
  } catch {
    return { user: null };
  }
}

/** Re-check the session only after a form submission (sign in, sign out, register, ...). */
export const rootShouldRevalidate: ShouldRevalidateFunction = ({
  formMethod,
  defaultShouldRevalidate,
}) => (formMethod ? defaultShouldRevalidate : false);

export function useSessionUser(): SessionUser | null {
  return (useRouteLoaderData(ROOT_ROUTE_ID) as RootData | undefined)?.user ?? null;
}

/** Only same-site paths are allowed as a post-sign-in destination (no open redirects). */
export function safeNext(next: string | null | undefined): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : null;
}

export const homeFor = (role: UserRole) => (role === "staff" ? "/staff" : "/account");

/**
 * For loaders of pages that need a role: returns the user, or throws a redirect to sign in
 * (guests) or to the user's own home page (wrong role).
 */
export async function requireRole(request: Request, role: UserRole): Promise<SessionUser> {
  const user = await getSession();
  if (!user) {
    const here = new URL(request.url);
    throw redirect(
      `/sign-in?${new URLSearchParams({ next: here.pathname + here.search }).toString()}`,
    );
  }
  if (user.role !== role) throw redirect(homeFor(user.role));
  return user;
}
