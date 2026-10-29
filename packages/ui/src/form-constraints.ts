import { getSchemaMetadata } from '@remix-run/data-schema'
import type { Schema } from '@remix-run/data-schema'

/**
 * Native HTML constraints that can be derived from a schema's checks.
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
 */
export interface GetConstraintsOptions {
  /** The native input type and its corresponding empty-value semantics. */
  type: 'checkbox' | 'email' | 'number' | 'password' | 'text' | 'url'
}

/**
 * Returns native HTML constraints represented by a schema's recognized checks.
 *
 * Checks without an equivalent native constraint are omitted. Requiredness may evaluate the
 * schema with `undefined` or `false` when metadata alone cannot determine it.
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

  if (options.type === 'number') {
    constraints.step = 'any'
  }

  if (
    options.type === 'checkbox'
      ? !schemaAcceptsValue(schema, false)
      : !schemaAcceptsUndefined(schema)
  ) {
    constraints.required = true
  }

  for (let check of getSchemaMetadata(schema).checks) {
    switch (check.code) {
      case 'string.min_length': {
        let minLength = getConstraintValue(check.values, 'min')
        if (minLength !== undefined) constraints.minLength = minLength
        break
      }
      case 'string.max_length': {
        let maxLength = getConstraintValue(check.values, 'max')
        if (maxLength !== undefined) constraints.maxLength = maxLength
        break
      }
      case 'number.min': {
        let min = getConstraintValue(check.values, 'min')
        if (min !== undefined) constraints.min = min
        break
      }
      case 'number.max': {
        let max = getConstraintValue(check.values, 'max')
        if (max !== undefined) constraints.max = max
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
