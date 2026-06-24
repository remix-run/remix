import * as s from "remix/data-schema";

export const SharedProjectFileSchema = s.object({
  name: s.string(),
  readonly: s.boolean(),
  contents: s.string(),
  implementation: s.optional(s.string()),
});

export type SharedProjectFile = s.InferOutput<typeof SharedProjectFileSchema>;

export const SharedProjectSchema = s.object({
  files: s.array(SharedProjectFileSchema).refine(
    (value) => value.length > 0,
    "At least one file is required",
  ).refine(
    (value) => JSON.stringify(value).length <= 2 * 1024 * 1024,
    "Total content length must not exceed 2 MB",
  ),
});

export type SharedProject = s.InferOutput<typeof SharedProjectSchema>;
