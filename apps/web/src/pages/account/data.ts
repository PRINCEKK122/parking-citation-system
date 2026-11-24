import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  US_STATES,
  classifyIdentifier,
  invalidFormatMessages,
  type PaymentHistoryItem,
  type SavedVehicle,
  type SessionUser,
  type StateCode,
} from "@pcs/shared";
import { ApiRequestError, addVehicle, listMyPayments, listVehicles } from "../../api/client.js";
import { requireRole } from "../../session.js";

export interface AccountData {
  user: SessionUser;
  vehicles: SavedVehicle[];
  payments: PaymentHistoryItem[];
}

export async function accountLoader({ request }: LoaderFunctionArgs): Promise<AccountData> {
  const user = await requireRole(request, "resident");
  const [vehicles, payments] = await Promise.all([listVehicles(), listMyPayments()]);
  return { user, vehicles, payments };
}

export interface AddVehicleResult {
  ok: boolean;
  values?: { nickname: string; q: string; state: string };
  errors?: Partial<Record<"nickname" | "q" | "state" | "form", string>>;
}

const asState = (s: string): StateCode | undefined => US_STATES.find(([c]) => c === s)?.[0];

export async function accountAction({ request }: ActionFunctionArgs): Promise<AddVehicleResult> {
  const form = await request.formData();
  const values = {
    nickname: String(form.get("nickname") ?? "").trim(),
    q: String(form.get("q") ?? ""),
    state: String(form.get("state") ?? ""),
  };

  const errors: AddVehicleResult["errors"] = {};
  if (!values.nickname) errors.nickname = "Give the vehicle a name, like “My car”.";
  else if (values.nickname.length > 40) errors.nickname = "Use 40 characters or fewer.";

  const id = classifyIdentifier(values.q, asState(values.state));
  if (!id.ok) {
    if (id.reason === "missing_state") errors.state = invalidFormatMessages.missing_state;
    else errors.q = invalidFormatMessages[id.reason];
  } else if (id.kind === "ticket") {
    errors.q =
      "Save the vehicle’s plate or VIN. A ticket number belongs to one citation, not a vehicle.";
  }
  if (Object.keys(errors).length || !id.ok || id.kind === "ticket")
    return { ok: false, values, errors };

  try {
    await addVehicle({
      nickname: values.nickname,
      identifier:
        id.kind === "plate"
          ? { kind: "plate", value: id.value, state: id.state }
          : { kind: "vin", value: id.value },
    });
    return { ok: true };
  } catch (e) {
    if (!(e instanceof ApiRequestError)) throw e;
    return {
      ok: false,
      values,
      errors: { form: "We couldn’t save the vehicle. Please try again." },
    };
  }
}
