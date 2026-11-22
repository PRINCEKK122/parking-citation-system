import { z } from "zod";

/** Money is always an integer number of cents. */
export const centsSchema = z.number().int().nonnegative();
export const positiveCentsSchema = z.number().int().positive();

export const idSchema = z.uuid();

/** ISO 8601 timestamp with an offset or Z, as JSON carries it. */
export const timestampSchema = z.iso.datetime({ offset: true });
