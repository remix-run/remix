import { createSchema } from './schema.ts'
import type { InferInput, InferOutput, Schema } from './schema.ts'

/**
 * Create a lazily-evaluated schema.
 *
 * This is useful for recursive schemas without circular module references.
 *
 * @param getSchema A function that returns the schema when first needed
 * @returns A schema that delegates validation to the resolved schema
 */
export function lazy<schema extends Schema<any, any>>(
  getSchema: () => schema,
): Schema<InferInput<schema>, InferOutput<schema>> {
  let cached: schema | undefined

  return createSchema(function validate(value, context) {
    if (!cached) {
      cached = getSchema()
    }

    return cached['~run'](value, context)
  })
}
