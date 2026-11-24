import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, type FieldPath } from "react-hook-form";
import { Link, useLocation, useNavigate, useRevalidator } from "react-router";
import { z } from "zod";
import { TEST_CARDS, payerSchema, type CitationSummary } from "@pcs/shared";
import { ApiRequestError, TokenizeFailure, createPayment, tokenizeCard } from "../../api/client.js";
import { CitationCard } from "../../components/CitationCard.js";
import { Page } from "../../components/Page.js";
import { StateCombobox } from "../../components/StateCombobox.js";
import { TextField } from "../../components/TextField.js";
import { config } from "../../config.js";
import { cardSchema, toTokenizeRequest } from "../../lib/card.js";
import { loadDraft, saveDraft, type PayerDraft } from "../../lib/draft.js";
import { formatCents } from "../../lib/format.js";
import { zodResolver } from "../../lib/zodResolver.js";
import { paths } from "../../paths.js";
import type { CheckoutLocationState } from "./loader.js";

const checkoutSchema = z.object({ payer: payerSchema, card: cardSchema() });
type CheckoutInput = z.input<typeof checkoutSchema>;
type CheckoutValues = z.output<typeof checkoutSchema>;

const EMPTY: CheckoutInput = {
  payer: {
    name: "",
    email: "",
    address: { line1: "", line2: "", city: "", state: "" as never, postalCode: "" },
  },
  card: { number: "", expiry: "", cvc: "" },
};

type Problem = "declined" | "gateway" | "amount_changed" | "not_payable" | "retry";

const FAILURE_TO_PROBLEM = {
  card_declined: "declined",
  gateway_error: "gateway",
  expired: "gateway",
} as const;

const MESSAGES: Record<Problem, string> = {
  declined:
    "Your card was declined, so nothing was charged. Your details are still filled in. Enter a different card to try again.",
  gateway:
    "The payment didn’t go through because of a problem with the payment processor. Nothing was charged. Please try again.",
  amount_changed:
    "The amount due has changed, probably because a late fee was just added. Check the new total below, then pay again.",
  not_payable: "This citation was paid while you were on this page, so we didn’t charge you.",
  retry:
    "We couldn’t confirm the payment because the connection dropped. Your details are kept. Press Pay again: you won’t be charged twice.",
};

/**
 * Checkout (F2, US2, test T4). Two rules shape it:
 * - Nothing but the card is ever cleared. Payer details are saved as they're typed, so they
 *   survive a decline, an error, or a reload.
 * - Each page visit has one Idempotency-Key, reused for every retry of the same payment, so
 *   double-clicks and network retries can never charge twice.
 */
export function CheckoutForm({ citation }: { citation: CitationSummary }) {
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const failure = (useLocation().state as CheckoutLocationState | null)?.failure;

  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [problem, setProblem] = useState<Problem | null>(
    failure ? FAILURE_TO_PROBLEM[failure] : null,
  );
  const inFlight = useRef(false);
  /** The token used with the current key, so a retry sends the identical request and is replayed. */
  const tokenForKey = useRef<{ key: string; card: string; token: string } | null>(null);

  const defaultValues = useMemo<CheckoutInput>(() => {
    const draft = loadDraft(citation.id);
    return draft ? { ...EMPTY, payer: draft as CheckoutInput["payer"] } : EMPTY;
  }, [citation.id]);

  const {
    register,
    control,
    handleSubmit,
    setError,
    setFocus,
    subscribe,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutInput, unknown, CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues,
    mode: "onTouched",
  });

  // Save payer details as they're typed (never the card).
  useEffect(
    () =>
      subscribe({
        name: "payer",
        formState: { values: true },
        callback: ({ values }) => saveDraft(citation.id, values.payer as PayerDraft),
      }),
    [subscribe, citation.id],
  );

  function newAttempt() {
    setIdempotencyKey(crypto.randomUUID());
    tokenForKey.current = null;
  }

  function cardError(field: FieldPath<CheckoutInput>, message: string) {
    setError(field, { type: "gateway", message });
    setFocus(field);
  }

  async function onSubmit(values: CheckoutValues) {
    if (inFlight.current) return; // a second click in the same instant
    inFlight.current = true;
    setProblem(null);
    try {
      const cardKey = `${values.card.number}|${values.card.expiry}|${values.card.cvc}`;
      let token =
        tokenForKey.current?.key === idempotencyKey && tokenForKey.current.card === cardKey
          ? tokenForKey.current.token
          : null;
      if (!token) {
        try {
          token = await tokenizeCard(toTokenizeRequest(values.card));
        } catch (e) {
          if (e instanceof TokenizeFailure) {
            if (e.reason === "expired_card")
              cardError(
                "card.expiry",
                "The card issuer says this card has expired. Use a different card.",
              );
            else
              cardError(
                "card.number",
                "This card wasn’t accepted. Check the number, or use a different card.",
              );
            return;
          }
          throw e;
        }
        tokenForKey.current = { key: idempotencyKey, card: cardKey, token };
      }

      const accepted = await createPayment(
        { citationId: citation.id, amountCents: citation.amountCents, payer: values.payer, token },
        idempotencyKey,
      );
      await navigate(paths.paymentStatus(accepted.paymentId));
    } catch (e) {
      if (!(e instanceof ApiRequestError)) throw e;
      switch (e.code) {
        case "amount_changed":
          newAttempt();
          setProblem("amount_changed");
          await revalidator.revalidate();
          break;
        case "citation_not_payable":
          setProblem("not_payable");
          break;
        case "idempotency_key_reused":
        case "validation_failed":
          newAttempt();
          setProblem("retry");
          break;
        default:
          // Network errors and 5xx: keep the same key and token, so pressing Pay again is a
          // safe replay of the same request.
          setProblem("retry");
      }
    } finally {
      inFlight.current = false;
    }
  }

  const err = (path: string) => {
    const parts = path.split(".");
    let node: unknown = errors;
    for (const p of parts) node = (node as Record<string, unknown> | undefined)?.[p];
    return (node as { message?: string } | undefined)?.message;
  };

  return (
    <Page title="Pay your citation" lead="Check the amount, then enter your details and card.">
      {problem ? (
        <div
          className={`alert ${problem === "amount_changed" || problem === "retry" ? "alert--warn" : "alert--error"}`}
          role="alert"
        >
          <p>{MESSAGES[problem]}</p>
          {problem === "not_payable" ? (
            <p>
              <Link to="/">Search again</Link> to see what’s still due.
            </p>
          ) : null}
        </div>
      ) : null}

      <CitationCard citation={citation} />

      <form className="checkout" onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        <fieldset className="card stack">
          <legend>Your details</legend>
          <p className="field__hint">
            Kept if the card is declined, so you won’t have to type them again.
          </p>
          <TextField
            label="Name on the card"
            autoComplete="cc-name"
            error={err("payer.name")}
            {...register("payer.name")}
          />
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            hint="We send the receipt here."
            error={err("payer.email")}
            {...register("payer.email")}
          />
          <TextField
            label="Street address"
            autoComplete="address-line1"
            error={err("payer.address.line1")}
            {...register("payer.address.line1")}
          />
          <TextField
            label="Apartment, suite, etc."
            optional
            autoComplete="address-line2"
            error={err("payer.address.line2")}
            {...register("payer.address.line2")}
          />
          <TextField
            label="City"
            autoComplete="address-level2"
            error={err("payer.address.city")}
            {...register("payer.address.city")}
          />
          <Controller
            control={control}
            name="payer.address.state"
            render={({ field, fieldState }) => (
              <div className="field">
                <label htmlFor="payer-state">State</label>
                <StateCombobox
                  id="payer-state"
                  inputRef={field.ref}
                  value={field.value ?? ""}
                  onChange={(code) => {
                    field.onChange(code);
                    field.onBlur();
                  }}
                  aria-invalid={fieldState.error ? true : undefined}
                  aria-describedby={fieldState.error ? "payer-state-err" : undefined}
                />
                {fieldState.error ? (
                  <p id="payer-state-err" className="field__error">
                    {fieldState.error.message}
                  </p>
                ) : null}
              </div>
            )}
          />
          <TextField
            label="ZIP code"
            inputMode="numeric"
            autoComplete="postal-code"
            className="input--short"
            error={err("payer.address.postalCode")}
            {...register("payer.address.postalCode")}
          />
        </fieldset>

        <fieldset className="card stack">
          <legend>Card</legend>
          <p className="field__hint">
            Your card goes straight to the payment processor. It is never sent to or stored by the
            city.
          </p>
          <TextField
            label="Card number"
            inputMode="numeric"
            autoComplete="cc-number"
            className="mono"
            error={err("card.number")}
            {...register("card.number")}
          />
          <div className="row">
            <TextField
              label="Expiry (MM/YY)"
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="MM/YY"
              className="mono"
              error={err("card.expiry")}
              {...register("card.expiry")}
            />
            <TextField
              label="Security code"
              inputMode="numeric"
              autoComplete="cc-csc"
              className="mono"
              error={err("card.cvc")}
              {...register("card.cvc")}
            />
          </div>
          {config.useMocks ? (
            <details className="test-cards">
              <summary>Test cards for this demo</summary>
              <ul>
                {TEST_CARDS.map((c) => (
                  <li key={c.number}>
                    <span className="mono">{c.number.replace(/(\d{4})(?=\d)/g, "$1 ")}</span>:{" "}
                    {c.label}
                  </li>
                ))}
              </ul>
              <p>Use any future expiry date and any 3-digit code.</p>
            </details>
          ) : null}
        </fieldset>

        <button
          type="submit"
          className="btn btn--primary btn--block"
          disabled={isSubmitting}
          aria-describedby="pay-note"
        >
          {isSubmitting ? "Processing…" : `Pay ${formatCents(citation.amountCents)}`}
        </button>
        <p id="pay-note" className="meta">
          You’ll be charged once, even if you press the button more than once.
        </p>
      </form>
    </Page>
  );
}
