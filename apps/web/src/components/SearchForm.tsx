import { useId, useRef, useState, type FormEvent } from "react";
import { useNavigate, useNavigation } from "react-router";
import {
  PLATE_MAX,
  PLATE_MIN,
  TICKET_DIGITS,
  US_STATES,
  VIN_LENGTH,
  classifyIdentifier,
  invalidFormatMessages,
  normalizeInput,
  type InvalidFormatReason,
  type StateCode,
} from "@pcs/shared";
import { paths } from "../paths.js";
import { StateCombobox } from "./StateCombobox.js";

interface SearchFormProps {
  defaultQuery?: string;
  defaultState?: string;
  /** A format error to show from the start, e.g. one the server returned. */
  initialError?: InvalidFormatReason;
}

const isStateCode = (s: string | undefined): s is StateCode => US_STATES.some(([c]) => c === s);

/** What the input looks like so far, shown under the field as the user types. */
function detectedKind(raw: string, hasState: boolean): string | null {
  const s = normalizeInput(raw);
  if (!s) return null;
  if (/^T\d+$/.test(s) && s.length > PLATE_MAX) return "Looks like a ticket number.";
  if (s.length === VIN_LENGTH) return "Looks like a VIN.";
  if (s.length >= PLATE_MIN && s.length <= PLATE_MAX) {
    return hasState
      ? "Looks like a license plate."
      : "Looks like a license plate. Choose its state below.";
  }
  return null;
}

/**
 * The one search field (feature F1). Format problems are caught here, before any request,
 * using the same classifier as the API, so the message matches what the server would say.
 */
export function SearchForm({
  defaultQuery = "",
  defaultState = "",
  initialError,
}: SearchFormProps) {
  const navigate = useNavigate();
  const navigation = useNavigation();
  const [query, setQuery] = useState(defaultQuery);
  const [state, setState] = useState<StateCode | "">(isStateCode(defaultState) ? defaultState : "");
  const [error, setError] = useState<InvalidFormatReason | null>(initialError ?? null);
  /** After the first failed attempt, re-check on every change so the error clears as soon as it's fixed. */
  const [touched, setTouched] = useState(Boolean(initialError));
  const queryRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef<HTMLInputElement>(null);

  const id = useId();
  const ids = {
    q: `${id}-q`,
    hint: `${id}-hint`,
    kind: `${id}-kind`,
    err: `${id}-err`,
    state: `${id}-state`,
  };

  const searching = navigation.state !== "idle" && navigation.location?.pathname === "/results";
  const stateError = error === "missing_state";
  const queryError = error && !stateError ? error : null;
  const kind = detectedKind(query, Boolean(state));

  function check(q: string, st: string) {
    return classifyIdentifier(q, isStateCode(st) ? st : undefined);
  }

  function revalidate(q: string, st: string) {
    if (!touched) return;
    const r = check(q, st);
    setError(r.ok ? null : r.reason);
  }

  function onBlur() {
    // Point out a malformed entry when the user leaves the field, but leave "choose a state"
    // until they submit, since the state field comes next.
    if (!query.trim()) return;
    const r = check(query, state);
    if (!r.ok && r.reason !== "missing_state") {
      setTouched(true);
      setError(r.reason);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    const r = check(query, state);
    if (!r.ok) {
      setError(r.reason);
      (r.reason === "missing_state" ? stateRef : queryRef).current?.focus();
      return;
    }
    setError(null);
    void navigate(paths.results(r.value, r.kind === "plate" ? r.state : undefined));
  }

  return (
    <form
      className="search card"
      onSubmit={onSubmit}
      noValidate
      role="search"
      aria-label="Find a citation"
    >
      <div className="field">
        <label htmlFor={ids.q}>Ticket number, license plate, or VIN</label>
        <p id={ids.hint} className="field__hint">
          For example T00012345, ABC1234, or 1HGCM82633A004352. Spaces and dashes are fine.
        </p>
        <input
          id={ids.q}
          ref={queryRef}
          name="q"
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            revalidate(e.target.value, state);
          }}
          onBlur={onBlur}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          maxLength={40}
          aria-invalid={queryError ? true : undefined}
          aria-describedby={[ids.hint, kind ? ids.kind : null, queryError ? ids.err : null]
            .filter(Boolean)
            .join(" ")}
          className="mono input"
        />
        {kind && !queryError ? (
          <p id={ids.kind} className="field__kind">
            {kind}
          </p>
        ) : null}
        {queryError ? (
          <p id={ids.err} className="field__error">
            {invalidFormatMessages[queryError]}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor={ids.state}>
          Plate state <span className="field__optional">(license plates only)</span>
        </label>
        <StateCombobox
          id={ids.state}
          inputRef={stateRef}
          value={state}
          onChange={(code) => {
            setState(code);
            revalidate(query, code);
          }}
          aria-invalid={stateError ? true : undefined}
          aria-describedby={stateError ? `${ids.state}-err` : undefined}
        />
        {stateError ? (
          <p id={`${ids.state}-err`} className="field__error">
            {invalidFormatMessages.missing_state}
          </p>
        ) : null}
      </div>

      <div>
        <button type="submit" className="btn btn--primary" disabled={searching}>
          {searching ? "Searching…" : "Search"}
        </button>
      </div>
      <p className="meta">
        Ticket numbers are T plus {TICKET_DIGITS} digits. VINs are {VIN_LENGTH} characters and are
        on your registration and the driver-side dashboard.
      </p>
    </form>
  );
}
