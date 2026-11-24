import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";
import type { z } from "zod";

/**
 * Connects a Zod schema to React Hook Form. It's small enough to own rather than depend on
 * @hookform/resolvers, which shipped two major versions in five weeks this fall.
 * Only the first problem per field is reported, as the form shows one message per field.
 */
export function zodResolver<S extends z.ZodType<FieldValues, FieldValues>>(
  schema: S,
): Resolver<z.input<S>, unknown, z.output<S>> {
  return async (values) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) return { values: result.data, errors: {} };

    const errors: Record<string, unknown> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.map(String);
      if (path.length === 0) continue;
      let node = errors;
      for (const key of path.slice(0, -1)) {
        node = (node[key] ??= {}) as Record<string, unknown>;
      }
      const leaf = path[path.length - 1]!;
      node[leaf] ??= { type: issue.code, message: issue.message };
    }
    return { values: {}, errors: errors as FieldErrors<z.input<S>> };
  };
}
