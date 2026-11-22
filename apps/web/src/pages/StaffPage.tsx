import { Page, Placeholder } from "../components/Page.js";

export function StaffPage() {
  return (
    <Page title="Staff console">
      <Placeholder card="S1-13">
        Find a citation, record a mailed or walk-in payment with its reference, and void a payment.
        A citation that is already paid is refused with a clear message.
      </Placeholder>
    </Page>
  );
}
