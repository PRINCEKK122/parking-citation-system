import express from "express";

/** Placeholder. Tokenize, charge, ledger, webhooks and fault injection arrive with card S2-07. */
const port = Number(process.env.GATEWAY_PORT ?? 4100);
const app = express();
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "gateway" });
});
app.listen(port, () => {
  console.info(`Simulated gateway listening on http://localhost:${port}`);
});
