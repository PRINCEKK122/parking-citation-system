import { useParams } from "react-router";
import { Page, Placeholder } from "../components/Page.js";

export function CheckoutPage() {
  const { citationId } = useParams();
  return (
    <Page title="Pay your citation" lead="Card details go straight to the payment processor.">
      <p className="meta">
        Citation <span className="mono">{citationId}</span>
      </p>
      <Placeholder card="S1-10">
        Payer and card form. If the card is declined, everything except the card number stays filled
        in, and a double-click can never charge twice.
      </Placeholder>
    </Page>
  );
}
