import type { Schema } from '@remix-run/data-schema';
/**
 * Native HTML constraints that can be derived from a schema's checks.
 */
export interface SchemaConstraints {
    /** Whether the input must contain a value or a checkbox must be checked. */
    required?: true;
    /** The minimum text length accepted by the schema. */
    minLength?: number;
    /** The maximum text length accepted by the schema. */
    maxLength?: number;
    /** The minimum numeric value accepted by the schema. */
    min?: number;
    /** The maximum numeric value accepted by the schema. */
    max?: number;
    /** The interval accepted by a numeric input. */
    step?: number | 'any';
}
/**
 * Input control context used to derive native HTML constraints.
 */
export interface GetConstraintsOptions {
    /** The native input type and its corresponding empty-value semantics. */
    type: 'checkbox' | 'email' | 'number' | 'password' | 'text' | 'url';
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
export declare function getConstraints<input, output>(schema: Schema<input, output>, options: GetConstraintsOptions): SchemaConstraints;
