import { useEffect, useRef } from "react";
import { Form, Link, useActionData, useNavigation, useSearchParams } from "react-router";
import { Page } from "../../components/Page.js";
import { TextField } from "../../components/TextField.js";
import { config } from "../../config.js";
import type { AuthActionData } from "./actions.js";

/** Keep ?next= when moving between sign in and register. */
function useNextQuery() {
  const [params] = useSearchParams();
  const next = params.get("next");
  return next ? `?${new URLSearchParams({ next }).toString()}` : "";
}

/** After a failed attempt, empty the password (the email is kept) so it's retyped, not reused. */
function useClearedPassword(data: AuthActionData | undefined) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (data && ref.current) ref.current.value = "";
  }, [data]);
  return ref;
}

function FormAlert({ data }: { data: AuthActionData | undefined }) {
  if (!data?.formError) return null;
  return (
    <div className="alert alert--error" role="alert">
      <p>{data.formError}</p>
    </div>
  );
}

export function SignInPage() {
  const data = useActionData<AuthActionData>();
  const busy = useNavigation().state === "submitting";
  const nextQuery = useNextQuery();
  const passwordRef = useClearedPassword(data);
  return (
    <Page
      title="Sign in"
      lead={
        <>
          You don’t need an account to pay. <Link to="/">Find a citation</Link> as a guest.
        </>
      }
    >
      <FormAlert data={data} />
      <Form method="post" className="card stack" noValidate>
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={data?.email}
          error={data?.fieldErrors?.email}
        />
        <TextField
          label="Password"
          ref={passwordRef}
          name="password"
          type="password"
          autoComplete="current-password"
          error={data?.fieldErrors?.password}
        />
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </Form>
      <p>
        New here? <Link to={`/register${nextQuery}`}>Create an account</Link> to save your vehicles
        and see past payments.
      </p>
      {config.useMocks ? (
        <details className="test-cards">
          <summary>Demo accounts</summary>
          <ul>
            <li>
              Resident: <span className="mono">resident@example.com</span> /{" "}
              <span className="mono">resident-pass-123</span>
            </li>
            <li>
              Staff: <span className="mono">staff@example.com</span> /{" "}
              <span className="mono">staff-pass-1234</span>
            </li>
          </ul>
        </details>
      ) : null}
    </Page>
  );
}

export function RegisterPage() {
  const data = useActionData<AuthActionData>();
  const busy = useNavigation().state === "submitting";
  const nextQuery = useNextQuery();
  const passwordRef = useClearedPassword(data);
  return (
    <Page title="Create an account" lead="Save your vehicles so you can check them in one tap.">
      <FormAlert data={data} />
      {data?.emailTaken ? (
        <p>
          <Link to={`/sign-in${nextQuery}`}>Sign in instead</Link>.
        </p>
      ) : null}
      <Form method="post" className="card stack" noValidate>
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={data?.email}
          error={data?.fieldErrors?.email}
        />
        <TextField
          label="Password"
          ref={passwordRef}
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 12 characters. A short sentence is easy to remember."
          error={data?.fieldErrors?.password}
        />
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </Form>
      <p>
        Already have an account? <Link to={`/sign-in${nextQuery}`}>Sign in</Link>.
      </p>
    </Page>
  );
}
