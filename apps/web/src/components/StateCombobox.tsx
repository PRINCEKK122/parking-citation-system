import { useId, useMemo, useState, type KeyboardEvent, type Ref } from "react";
import { US_STATES, matchStates, type StateCode } from "@pcs/shared";

interface StateComboboxProps {
  id: string;
  value: StateCode | "";
  onChange: (code: StateCode | "") => void;
  inputRef?: Ref<HTMLInputElement>;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

const label = (code: StateCode | "") => {
  const name = US_STATES.find(([c]) => c === code)?.[1];
  return name ? `${name} (${code})` : "";
};

/**
 * Plate-state picker (test T3). Fixes the portal bug where typing "MO" chose Montana: an exact
 * USPS code ranks first, then names that start with the text, then names that contain it.
 *
 * WAI-ARIA combobox, "list autocomplete with automatic selection": the best match is
 * highlighted as you type, and Enter or Tab (leaving the field) accepts it.
 */
export function StateCombobox({ id, value, onChange, inputRef, ...aria }: StateComboboxProps) {
  const listId = useId();
  const [text, setText] = useState(label(value));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  /** True once the user types after focusing, so tabbing through doesn't change the choice. */
  const [dirty, setDirty] = useState(false);

  const matches = useMemo(() => (dirty ? matchStates(text) : matchStates("")), [dirty, text]);
  const activeOption = open ? matches[active] : undefined;
  const optionId = (code: string) => `${listId}-${code}`;

  function pick(code: StateCode | "") {
    onChange(code);
    setText(label(code));
    setOpen(false);
    setDirty(false);
  }

  function commitOnLeave() {
    if (!dirty) {
      setOpen(false);
      return;
    }
    if (!text.trim()) return pick("");
    const choice = matches[active] ?? matches[0];
    if (choice) return pick(choice.code);
    // Nothing matches: keep what was typed so it can be fixed, but no state is chosen.
    onChange("");
    setOpen(false);
  }

  function move(delta: number) {
    if (!open) {
      setOpen(true);
      setActive(
        Math.max(
          0,
          matches.findIndex((m) => m.code === value),
        ),
      );
      return;
    }
    const next = (active + delta + matches.length) % matches.length;
    setActive(next);
    const code = matches[next]?.code;
    if (code) document.getElementById(optionId(code))?.scrollIntoView?.({ block: "nearest" });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
      case "Enter":
        // Accept the highlighted state instead of submitting the form.
        if (open && activeOption) {
          e.preventDefault();
          pick(activeOption.code);
        }
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          setOpen(false);
          setText(label(value));
          setDirty(false);
        }
        break;
    }
  }

  return (
    <div className="combo">
      <input
        id={id}
        ref={inputRef}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={activeOption ? optionId(activeOption.code) : undefined}
        aria-invalid={aria["aria-invalid"]}
        aria-describedby={aria["aria-describedby"]}
        className="input"
        placeholder="Type a state or its 2-letter code"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
          setOpen(true);
          setActive(0);
        }}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commitOnLeave}
        onKeyDown={onKeyDown}
      />
      <ul id={listId} role="listbox" aria-label="States" className="combo__list" hidden={!open}>
        {matches.map((s, i) => (
          <li
            key={s.code}
            id={optionId(s.code)}
            role="option"
            aria-selected={i === active}
            className="combo__option"
            // mousedown fires before the input's blur, so the click isn't lost.
            onMouseDown={(e) => {
              e.preventDefault();
              pick(s.code);
            }}
            onMouseMove={() => setActive(i)}
          >
            <span>{s.name}</span>
            <span className="combo__code">{s.code}</span>
          </li>
        ))}
        {matches.length === 0 ? (
          <li className="combo__empty" role="presentation">
            No state matches “{text.trim()}”
          </li>
        ) : null}
      </ul>
      <p className="sr-only" role="status">
        {open ? `${matches.length} ${matches.length === 1 ? "state matches" : "states match"}` : ""}
      </p>
    </div>
  );
}
