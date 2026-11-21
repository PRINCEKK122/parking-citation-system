import { defineConfig } from "tsup";

// Bundle workspace packages (@pcs/*) into the output; keep npm dependencies external.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  clean: true,
  noExternal: [/^@pcs\//],
});
