import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { StateCode } from "@pcs/shared";
import { StateCombobox } from "./StateCombobox.js";

afterEach(cleanup);

/** The combo box inside a form, with its value shown so tests can read what was chosen. */
function Harness({ initial = "" as StateCode | "", onSubmit = () => {} }) {
  const [value, setValue] = useState<StateCode | "">(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="st">Plate state</label>
      <StateCombobox id="st" value={value} onChange={setValue} />
      <span data-testid="value">{value}</span>
      <button type="submit">Search</button>
    </form>
  );
}

function setup(props: Parameters<typeof Harness>[0] = {}) {
  const user = userEvent.setup();
  render(<Harness {...props} />);
  const input = screen.getByRole("combobox", { name: "Plate state" }) as HTMLInputElement;
  return { user, input, value: () => screen.getByTestId("value").textContent };
}

const highlighted = (input: HTMLInputElement) =>
  document.getElementById(input.getAttribute("aria-activedescendant") ?? "")?.textContent;
const optionNames = () =>
  within(screen.getByRole("listbox", { hidden: true }))
    .queryAllByRole("option")
    .map((o) => o.firstElementChild?.textContent);

describe("StateCombobox (test T3)", () => {
  it("T3: typing MO and leaving the field selects Missouri, not Montana", async () => {
    const { user, input, value } = setup();
    await user.type(input, "MO");
    expect(highlighted(input)).toBe("MissouriMO");
    expect(optionNames().slice(0, 2)).toEqual(["Missouri", "Montana"]);
    await user.tab();
    expect(value()).toBe("MO");
    expect(input.value).toBe("Missouri (MO)");
  });

  it("matches the code in any case, and Enter accepts it without submitting the form", async () => {
    const onSubmit = vi.fn();
    const { user, input, value } = setup({ onSubmit });
    await user.type(input, "mo{Enter}");
    expect(value()).toBe("MO");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  it("finds states by full name, and arrow keys move through the matches", async () => {
    const { user, input, value } = setup();
    await user.type(input, "miss");
    expect(optionNames()).toEqual(["Mississippi", "Missouri"]);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(value()).toBe("MO");
  });

  it("lists every state that starts with the text first", async () => {
    const { user, input } = setup();
    await user.type(input, "new");
    expect(optionNames().slice(0, 4)).toEqual([
      "New Hampshire",
      "New Jersey",
      "New Mexico",
      "New York",
    ]);
    expect(screen.getByRole("status").textContent).toBe("4 states match");
  });

  it("can be picked with the mouse", async () => {
    const { user, input, value } = setup();
    await user.type(input, "il");
    await user.click(screen.getByRole("option", { name: /Illinois/ }));
    expect(value()).toBe("IL");
  });

  it("Escape closes the list and keeps the earlier choice", async () => {
    const { user, input, value } = setup({ initial: "MO" });
    await user.click(input);
    await user.keyboard("Tex");
    expect(input.getAttribute("aria-expanded")).toBe("true");
    await user.keyboard("{Escape}");
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(input.value).toBe("Missouri (MO)");
    expect(value()).toBe("MO");
  });

  it("tabbing through without typing does not change the choice", async () => {
    const { user, input, value } = setup({ initial: "IL" });
    await user.click(input);
    await user.tab();
    expect(value()).toBe("IL");
    expect(input.value).toBe("Illinois (IL)");
  });

  it("says when nothing matches and leaves no state chosen", async () => {
    const { user, input, value } = setup({ initial: "MO" });
    await user.click(input);
    await user.keyboard("zz");
    expect(screen.getByText("No state matches “zz”")).toBeTruthy();
    await user.tab();
    expect(value()).toBe("");
    expect(input.value).toBe("zz");
  });

  it("clearing the field clears the choice", async () => {
    const { user, input, value } = setup({ initial: "MO" });
    await user.clear(input);
    await user.tab();
    expect(value()).toBe("");
  });

  it("opens the full list with the down arrow, starting at the current choice", async () => {
    const { user, input } = setup({ initial: "TX" });
    await user.click(input);
    await user.keyboard("{ArrowDown}");
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(highlighted(input)).toBe("TexasTX");
  });
});
