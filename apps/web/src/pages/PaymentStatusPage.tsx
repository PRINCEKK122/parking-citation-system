import { useParams } from "react-router";
import { Page, Placeholder } from "../components/Page.js";

export function PaymentStatusPage() {
  const { paymentId } = useParams();
  return (
    <Page title="Payment status">
      <p className="meta">
        Payment <span className="mono">{paymentId}</span>
      </p>
      <Placeholder card="S1-11">
        Shows “processing” while the payment is confirmed, then the receipt, or a way back to
        checkout with your details kept if the payment failed.
      </Placeholder>
    </Page>
  );
}
