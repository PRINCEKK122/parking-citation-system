import { z } from "zod";

const envSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
});

export type ApiConfig = z.infer<typeof envSchema>;

/** Parse env once at startup; fail fast with a readable message. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid API configuration: ${parsed.error.message}`);
  }
  return parsed.data;
}
