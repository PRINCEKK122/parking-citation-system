import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { App } from "./App.js";

describe("App", () => {
  it("renders the home heading", () => {
    expect(renderToString(<App />)).toContain("Pay a parking citation");
  });
});
