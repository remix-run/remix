import { createSchema, fail } from './schema.ts'
import type { Schema } from './schema.ts'

/**
 * Coerce input into a number.
 *
 * Accepts:
 * - finite `number` values (excluding `NaN` and `Infinity`)
 * - strings parsed with `Number(...)` after trimming (must produce finite result)
 *
 * @returns A schema that produces a `number`
 */
export function coerceNumber(): Schema<unknown, number> {
  return createSchema(function validate(value, context) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return { value }
    }

    if (typeof value === 'string') {
      let trimmed = value.trim()

      if (trimmed.length === 0) {
        return fail('Expected number', context.path, {
          code: 'coerce.number',
          input: value,
          parseOptions: context.options,
        })
      }

      let parsed = Number(trimmed)

      if (Number.isFinite(parsed)) {
        return { value: parsed }
      }
    }

    return fail('Expected number', context.path, {
      code: 'coerce.number',
      input: value,
      parseOptions: context.options,
    })
  })
}

/**
 * Coerce input into a boolean.
 *
 * Accepts:
 * - `boolean` values as-is
 * - strings `"true"` and `"false"` (case-insensitive, trimmed)
 *
 * @returns A schema that produces a `boolean`
 */
export function coerceBoolean(): Schema<unknown, boolean> {
  return createSchema(function validate(value, context) {
    if (typeof value === 'boolean') {
      return { value }
    }

    if (typeof value === 'string') {
      let normalized = value.trim().toLowerCase()

      if (normalized === 'true') {
        return { value: true }
      }

      if (normalized === 'false') {
        return { value: false }
      }
    }

    return fail('Expected boolean', context.path, {
      code: 'coerce.boolean',
      input: value,
      parseOptions: context.options,
    })
  })
}

/**
 * Coerce input into a `Date`.
 *
 * Accepts:
 * - valid `Date` instances
 * - date strings supported by `new Date(value)`
 *
 * @returns A schema that produces a `Date`
 */
export function coerceDate(): Schema<unknown, Date> {
  return createSchema(function validate(value, context) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return { value }
    }

    if (typeof value === 'string') {
      let parsed = new Date(value)

      if (!Number.isNaN(parsed.getTime())) {
        return { value: parsed }
      }
    }

    return fail('Expected date', context.path, {
      code: 'coerce.date',
      input: value,
      parseOptions: context.options,
    })
  })
}

/**
 * Coerce input into a `bigint`.
 *
 * Accepts:
 * - `bigint` values as-is
 * - integer `number` values
 * - integer strings parsed via `BigInt(...)`
 *
 * @returns A schema that produces a `bigint`
 */
export function coerceBigint(): Schema<unknown, bigint> {
  return createSchema(function validate(value, context) {
    if (typeof value === 'bigint') {
      return { value }
    }

    if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)) {
      return { value: BigInt(value) }
    }

    if (typeof value === 'string') {
      let trimmed = value.trim()

      if (trimmed.length === 0) {
        return fail('Expected bigint', context.path, {
          code: 'coerce.bigint',
          input: value,
          parseOptions: context.options,
        })
      }

      try {
        return { value: BigInt(trimmed) }
      } catch {
        return fail('Expected bigint', context.path, {
          code: 'coerce.bigint',
          input: value,
          parseOptions: context.options,
        })
      }
    }

    return fail('Expected bigint', context.path, {
      code: 'coerce.bigint',
      input: value,
      parseOptions: context.options,
    })
  })
}

/**
 * Coerce input into a string.
 *
 * Accepts:
 * - `string` values as-is
 * - primitive values that can be stringified (`number`, `boolean`, `bigint`, `symbol`)
 *
 * @returns A schema that produces a `string`
 */
export function coerceString(): Schema<unknown, string> {
  return createSchema(function validate(value, context) {
    if (typeof value === 'string') {
      return { value }
    }

    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint' ||
      typeof value === 'symbol'
    ) {
      return { value: String(value) }
    }

    return fail('Expected string', context.path, {
      code: 'coerce.string',
      input: value,
      parseOptions: context.options,
    })
  })
}
