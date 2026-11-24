import { redirect, type ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { registerRequestSchema, signInRequestSchema } from "@pcs/shared";
import { ApiRequestError, register, signIn, signOut } from "../../api/client.js";
import { homeFor, safeNext } from "../../session.js";

/** What an auth form gets back when it can't proceed: the email to refill, and messages. */
export interface AuthActionData {
  email: string;
  fieldErrors?: Partial<Record<"email" | "password", string>>;
  formError?: string;
  emailTaken?: boolean;
}

const first = (errors: Record<string, string[] | undefined>) =>
  Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v?.[0]]));

async function readCredentials(request: Request) {
  const form = await request.formData();
  return {
    email: String(form.get("email") ?? "").trim(),
    password: String(form.get("password") ?? ""),
  };
}

const destination = (request: Request, role: "resident" | "staff") =>
  safeNext(new URL(request.url).searchParams.get("next")) ?? homeFor(role);

export async function signInAction({
  request,
}: ActionFunctionArgs): Promise<AuthActionData | Response> {
  const values = await readCredentials(request);
  const parsed = signInRequestSchema.safeParse(values);
  if (!parsed.success)
    return { email: values.email, fieldErrors: first(z.flattenError(parsed.error).fieldErrors) };
  try {
    const { user } = await signIn(parsed.data);
    return redirect(destination(request, user.role));
  } catch (e) {
    if (e instanceof ApiRequestError && e.status === 401) {
      return {
        email: values.email,
        formError: "That email and password don’t match an account. Check them and try again.",
      };
    }
    return {
      email: values.email,
      formError: "We couldn’t sign you in right now. Please try again in a moment.",
    };
  }
}

export async function registerAction({
  request,
}: ActionFunctionArgs): Promise<AuthActionData | Response> {
  const values = await readCredentials(request);
  const parsed = registerRequestSchema.safeParse(values);
  if (!parsed.success)
    return { email: values.email, fieldErrors: first(z.flattenError(parsed.error).fieldErrors) };
  try {
    const { user } = await register(parsed.data);
    return redirect(destination(request, user.role));
  } catch (e) {
    if (e instanceof ApiRequestError && e.code === "email_taken") {
      return {
        email: values.email,
        emailTaken: true,
        formError: "There’s already an account with this email.",
      };
    }
    return {
      email: values.email,
      formError: "We couldn’t create your account right now. Please try again in a moment.",
    };
  }
}

export async function signOutAction(): Promise<Response> {
  try {
    await signOut();
  } catch {
    // Signing out locally still matters; the root loader re-checks the session either way.
  }
  return redirect("/");
}
