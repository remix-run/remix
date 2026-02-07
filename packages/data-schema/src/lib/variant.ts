import { createSchema, fail } from './schema.ts'
import type { InferOutput, Schema } from './schema.ts'

/**
 * Create a discriminated-union schema.
 *
 * The returned schema expects an object with a `discriminator` property and selects a variant schema
 * based on that value.
 *
 * @param discriminator The property name used to select a variant
 * @param variants A mapping from discriminator value to schema
 * @returns A schema that produces the selected variant output type
 */
export function variant<
  key extends PropertyKey,
  variants extends Record<PropertyKey, Schema<any, any>>,
>(discriminator: key, variants: variants): Schema<unknown, InferOutput<variants[keyof variants]>> {
  return createSchema(function validate(value, context) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return fail('Expected object', context.path)
    }

    let input = value as Record<PropertyKey, unknown>
    let tag = input[discriminator]

    if (tag === undefined) {
      return fail('Expected discriminator', [...context.path, discriminator])
    }

    if (typeof tag !== 'string' && typeof tag !== 'number' && typeof tag !== 'symbol') {
      return fail('Unknown discriminator', [...context.path, discriminator])
    }

    if (!Object.prototype.hasOwnProperty.call(variants, tag)) {
      return fail('Unknown discriminator', [...context.path, discriminator])
    }

    let schema = variants[tag as keyof variants]
    return schema['~run'](value, context)
  })
}
