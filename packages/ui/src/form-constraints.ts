import { getSchemaMetadata } from '@remix-run/data-schema/experimental'
import type { Schema } from '@remix-run/data-schema'

/**
 * Native HTML constraints that can be derived from a schema's checks.
 * This experimental API may change or be removed in patch releases.
 */
export interface SchemaConstraints {
  /** Whether the input must contain a value or a checkbox must be checked. */
  required?: true
  /** The minimum text length accepted by the schema. */
  minLength?: number
  /** The maximum text length accepted by the schema. */
  maxLength?: number
  /** The minimum numeric value accepted by the schema. */
  min?: number
  /** The maximum numeric value accepted by the schema. */
  max?: number
  /** The interval accepted by a numeric input. */
  step?: number | 'any'
}

/**
 * Input control context used to derive native HTML constraints.
 * This experimental API may change or be removed in patch releases.
 */
export interface GetConstraintsOptions {
  /** The native input type, `select`, or `textarea`, with its empty-value semantics. */
  type:
    | 'button'
    | 'checkbox'
    | 'color'
    | 'date'
    | 'datetime-local'
    | 'email'
    | 'file'
    | 'hidden'
    | 'image'
    | 'month'
    | 'number'
    | 'password'
    | 'radio'
    | 'range'
    | 'reset'
    | 'search'
    | 'select'
    | 'submit'
    | 'tel'
    | 'text'
    | 'textarea'
    | 'time'
    | 'url'
    | 'week'
  /** Whether a select, checkbox group, or file control reads an array (defaults to false). */
  multiple?: boolean
}

/**
 * Returns native HTML constraints represented by a schema's recognized checks.
 *
 * Checks without an equivalent native constraint are omitted. Requiredness may evaluate the
 * schema with `undefined`, `false`, or an empty array when metadata cannot determine it.
 *
 * This experimental API may change or be removed in patch releases.
 *
 * @param schema The schema to inspect.
 * @param options The input control receiving the constraints.
 * @returns Constraint attributes that can be spread onto a native `input` element.
 */
export function getConstraints<input, output>(
  schema: Schema<input, output>,
  options: GetConstraintsOptions,
): SchemaConstraints {
  let constraints: SchemaConstraints = {}

  let numeric = options.type === 'number' || options.type === 'range'
  let text = ['text', 'search', 'tel', 'url', 'email', 'password', 'textarea'].includes(
    options.type,
  )
  if (['hidden', 'button', 'submit', 'reset', 'image'].includes(options.type)) return constraints

  if (numeric) {
    constraints.step = 'any'
  }

  if (options.type !== 'range' && options.type !== 'color') {
    let acceptsEmpty = options.multiple
      ? schemaAcceptsValue(schema, [])
      : options.type === 'checkbox'
        ? schemaAcceptsValue(schema, false)
        : schemaAcceptsUndefined(schema)
    if (!acceptsEmpty && !(options.type === 'checkbox' && options.multiple))
      constraints.required = true
  }

  let metadata = getSchemaMetadata(schema)
  for (let check of metadata.inputChecks ?? metadata.checks) {
    switch (check.code) {
      case 'string.min_length': {
        let minLength = getConstraintValue(check.values, 'min')
        if (text && minLength !== undefined) constraints.minLength = minLength
        break
      }
      case 'string.max_length': {
        let maxLength = getConstraintValue(check.values, 'max')
        if (text && maxLength !== undefined) constraints.maxLength = maxLength
        break
      }
      case 'number.min': {
        let min = getConstraintValue(check.values, 'min')
        if (numeric && min !== undefined) constraints.min = min
        break
      }
      case 'number.max': {
        let max = getConstraintValue(check.values, 'max')
        if (numeric && max !== undefined) constraints.max = max
        break
      }
    }
  }

  return constraints
}

function schemaAcceptsUndefined<input, output>(schema: Schema<input, output>): boolean {
  let acceptsUndefined = getSchemaMetadata(schema).acceptsUndefined

  if (acceptsUndefined !== undefined) {
    return acceptsUndefined
  }

  return !schema['~run'](undefined, { path: [] }).issues
}

function schemaAcceptsValue<input, output>(schema: Schema<input, output>, value: unknown): boolean {
  return !schema['~run'](value, { path: [] }).issues
}

function getConstraintValue(
  values: Record<string, unknown> | undefined,
  key: string,
): number | undefined {
  let value = values?.[key]
  return typeof value === 'number' ? value : undefined
}
