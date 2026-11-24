import { useState } from "react";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import type { PaymentState, StateCode } from "@pcs/shared";
import { Page } from "../../components/Page.js";
import { StateCombobox } from "../../components/StateCombobox.js";
import { TextField } from "../../components/TextField.js";
import { describeIdentifier, formatCents, formatDate } from "../../lib/format.js";
import { paths } from "../../paths.js";
import type { AccountData, AddVehicleResult } from "./data.js";

const STATE_LABELS: Record<PaymentState, { text: string; tone: string }> = {
  created: { text: "Started", tone: "neutral" },
  processing: { text: "Processing", tone: "warn" },
  succeeded: { text: "Paid", tone: "ok" },
  failed: { text: "Failed", tone: "error" },
};

/** Resident account (F3, card S1-12): saved vehicles to look up in one tap, and past payments. */
export function AccountPage() {
  const { user, vehicles, payments } = useLoaderData<AccountData>();
  return (
    <Page title="Your account" lead={`Signed in as ${user.email}.`}>
      <section className="stack" aria-labelledby="vehicles-h">
        <h2 id="vehicles-h">Saved vehicles</h2>
        {vehicles.length ? (
          <ul className="citations">
            {vehicles.map((v) => (
              <li key={v.id} className="card vehicle">
                <div>
                  <p className="vehicle__name">{v.nickname}</p>
                  <p className="meta">{describeIdentifier(v.identifier)}</p>
                </div>
                <Link
                  className="btn btn--primary"
                  to={paths.results(v.identifier.value, v.identifier.state)}
                  aria-label={`Look up citations for ${v.nickname}`}
                >
                  Look up
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="meta">No saved vehicles yet. Add one below to check it in one tap.</p>
        )}
        {/* Remount after each save so the form starts empty again. */}
        <AddVehicleForm key={vehicles.length} />
      </section>

      <section className="stack" aria-labelledby="payments-h">
        <h2 id="payments-h">Payment history</h2>
        {payments.length ? (
          <table className="history">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Ticket</th>
                <th scope="col">Amount</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.paymentId}>
                  <td>{formatDate(p.createdAt)}</td>
                  <td>
                    <Link className="mono" to={paths.paymentStatus(p.paymentId)}>
                      {p.ticketNo}
                    </Link>
                  </td>
                  <td>{formatCents(p.amountCents)}</td>
                  <td>
                    <span className={`tag tag--${STATE_LABELS[p.state].tone}`}>
                      {STATE_LABELS[p.state].text}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="meta">Payments you make while signed in will appear here.</p>
        )}
      </section>
    </Page>
  );
}

function AddVehicleForm() {
  const result = useActionData<AddVehicleResult>();
  const failed = result && !result.ok ? result : undefined;
  const busy = useNavigation().state === "submitting";
  const [state, setState] = useState<StateCode | "">((failed?.values?.state as StateCode) ?? "");

  return (
    <Form method="post" className="card stack" noValidate aria-labelledby="add-h">
      <h3 id="add-h">Add a vehicle</h3>
      {failed?.errors?.form ? (
        <div className="alert alert--error" role="alert">
          <p>{failed.errors.form}</p>
        </div>
      ) : null}
      <TextField
        label="Name"
        name="nickname"
        hint="Something you’ll recognise, like “My car” or “Work van”."
        defaultValue={failed?.values?.nickname}
        error={failed?.errors?.nickname}
      />
      <TextField
        label="License plate or VIN"
        name="q"
        className="mono"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        defaultValue={failed?.values?.q}
        error={failed?.errors?.q}
      />
      <div className="field">
        <label htmlFor="add-state">
          Plate state <span className="field__optional">(license plates only)</span>
        </label>
        <StateCombobox
          id="add-state"
          value={state}
          onChange={setState}
          aria-invalid={failed?.errors?.state ? true : undefined}
          aria-describedby={failed?.errors?.state ? "add-state-err" : undefined}
        />
        <input type="hidden" name="state" value={state} />
        {failed?.errors?.state ? (
          <p id="add-state-err" className="field__error">
            {failed.errors.state}
          </p>
        ) : null}
      </div>
      <div>
        <button type="submit" className="btn" disabled={busy}>
          {busy ? "Saving…" : "Save vehicle"}
        </button>
      </div>
    </Form>
  );
}
