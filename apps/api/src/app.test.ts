import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";

describe("api app", () => {
  it("reports health", async () => {
    const res = await request(createApp()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", service: "api" });
  });

  it("returns the JSON error shape for unknown routes", async () => {
    const res = await request(createApp()).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
  });
});
