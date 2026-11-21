import express, { type ErrorRequestHandler } from "express";
import type { ApiError } from "@pcs/shared";

/** App factory, so tests can create an app without opening a port. */
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "api" });
  });

  app.use((_req, res) => {
    const body: ApiError = { error: { code: "not_found", message: "No such route." } };
    res.status(404).json(body);
  });

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err);
    const body: ApiError = { error: { code: "internal", message: "Something went wrong." } };
    res.status(500).json(body);
  };
  app.use(onError);

  return app;
}
