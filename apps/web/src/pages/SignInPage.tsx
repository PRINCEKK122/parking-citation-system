import { Link } from "react-router";
import { Page, Placeholder } from "../components/Page.js";

export function SignInPage() {
  return (
    <Page
      title="Sign in"
      lead={
        <>
          You don’t need an account to pay. <Link to="/">Find a citation</Link> as a guest.
        </>
      }
    >
      <Placeholder card="S1-12">
        Sign in and create-account forms for residents and staff.
      </Placeholder>
    </Page>
  );
}
