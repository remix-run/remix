import type { StandardSchemaV1 } from '@standard-schema/spec';
/**
 * A validation issue returned by a schema, compatible with Standard Schema v1.
 *
 * Issues include a human-readable `message` and an optional `path` that points to the
 * failing location in the input (e.g. `['user', 'email']` or `[0, 'id']`).
 */
export type Issue = StandardSchemaV1.Issue;
/**
 * The result of schema validation.
 *
 * On success, `value` is present and `issues` is absent. On failure, `issues` is present.
 */
export type ValidationResult<output> = StandardSchemaV1.Result<output>;
/**
 * Options passed to `~standard.validate`.
 */
export type ValidationOptions = StandardSchemaV1.Options;
/**
 * Context passed to `errorMap` to customize issue messages.
 */
export type ErrorMapContext = {
    code: string;
    defaultMessage: string;
    path?: Issue['path'];
    values?: Record<string, unknown>;
    input: unknown;
    locale?: string;
};
/**
 * Function used to customize issue messages.
 *
 * Return `undefined` to use the default message.
 */
export type ErrorMap = (context: ErrorMapContext) => string | undefined;
/**
 * Options passed to `parse` and `parseSafe`.
 *
 * This mirrors `ValidationOptions`, but also supports a convenience `abortEarly` option at the top level.
 */
export type ParseOptions = StandardSchemaV1.Options & {
    abortEarly?: boolean;
    errorMap?: ErrorMap;
    locale?: string;
};
type SyncStandardSchemaProps<input, output> = Omit<StandardSchemaV1.Props<input, output>, 'validate'> & {
    validate: (value: unknown, options?: ValidationOptions) => ValidationResult<output>;
    types?: StandardSchemaV1.Types<input, output> | undefined;
};
type SyncStandardSchema<input, output = input> = {
    '~standard': SyncStandardSchemaProps<input, output>;
};
/**
 * A reusable check for use with `schema.pipe(...)`.
 */
export type Check<output> = {
    check: (value: output) => boolean;
    message?: string;
    code?: string;
    values?: Record<string, unknown>;
};
/**
 * A sync, Standard Schema v1-compatible schema with a small chainable API.
 */
export type Schema<input, output = input> = SyncStandardSchema<input, output> & {
    /**
     * Compose one or more reusable checks onto this schema.
     *
     * Checks run after the underlying schema has validated and produced an `output` value.
     * If any check fails, validation fails with an issue (using the check's `message` if provided).
     *
     * @param checks One or more `Check`s to apply in order
     * @returns A new schema with the checks applied
     */
    pipe: (...checks: Check<output>[]) => Schema<input, output>;
    /**
     * Add an inline predicate check onto this schema.
     *
     * The predicate runs after the underlying schema has validated and produced an `output` value.
     * If the predicate returns `false`, validation fails with an issue.
     *
     * @param predicate A function that returns `true` for valid values
     * @param message Optional issue message when the predicate fails
     * @returns A new schema with the refinement applied
     */
    refine: (predicate: (value: output) => boolean, message?: string) => Schema<input, output>;
    /**
     * Internal validator used to validate nested values while preserving `path`/`options`.
     */
    '~run': (value: unknown, context: ValidationContext) => ValidationResult<output>;
};
/**
 * Infers the input type of a schema-like value.
 */
export type InferInput<schema> = schema extends StandardSchemaV1<infer input, any> ? input : never;
/**
 * Infers the output type of a schema-like value.
 */
export type InferOutput<schema> = schema extends StandardSchemaV1<any, infer output> ? output : never;
type ValidationContext = {
    path: NonNullable<Issue['path']>;
    options?: ParseOptions;
};
export declare function createSchema<input, output>(validator: (value: unknown, context: {
    path: NonNullable<Issue['path']>;
    options?: ParseOptions;
}) => ValidationResult<output>): Schema<input, output>;
export declare function createIssue(message: string, path: Issue['path']): Issue;
export declare function fail(message: string, path: Issue['path'], options?: {
    code?: string;
    values?: Record<string, unknown>;
    input?: unknown;
    parseOptions?: ParseOptions;
}): StandardSchemaV1.FailureResult;
/**
 * Create a schema that accepts any value without validation.
 *
 * @returns A schema that produces `unknown`
 */
export declare function any(): Schema<any, unknown>;
/**
 * Create a schema that validates an array by validating each element with `elementSchema`.
 *
 * @param elementSchema The schema to validate each element
 * @returns A schema that produces an array of validated outputs
 */
export declare function array<input, output>(elementSchema: Schema<input, output>): Schema<unknown, output[]>;
/**
 * Create a schema that accepts bigints.
 *
 * @returns A schema that produces a `bigint`
 */
export declare function bigint(): Schema<unknown, bigint>;
/**
 * Create a schema that accepts booleans.
 *
 * @returns A schema that produces a `boolean`
 */
export declare function boolean(): Schema<unknown, boolean>;
/**
 * Provide a default when the input is `undefined`.
 *
 * @param schema The wrapped schema
 * @param defaultValue A value or function used to produce the default
 * @returns A schema that produces the default when the input is `undefined`
 */
export declare function defaulted<input, output>(schema: Schema<input, output>, defaultValue: output | (() => output)): Schema<input | undefined, output>;
/**
 * Create a schema that accepts one of the given values using strict equality (`===`).
 *
 * @param values The allowed values
 * @returns A schema that produces the union of allowed value types
 */
export declare function enum_<const values extends readonly [unknown, ...unknown[]]>(values: values): Schema<unknown, values[number]>;
/**
 * Create a schema that validates a value is an instance of a class.
 *
 * @param constructor The class constructor to check against
 * @returns A schema that produces the instance type
 */
export declare function instanceof_<constructor extends abstract new (...args: any[]) => any>(constructor: constructor): Schema<unknown, InstanceType<constructor>>;
/**
 * Create a schema that accepts a single literal value using strict equality (`===`).
 *
 * @param literalValue The literal value to match
 * @returns A schema that produces the literal type
 */
export declare function literal<value>(literalValue: value): Schema<unknown, value>;
/**
 * Create a schema that validates a Map with typed keys and values.
 *
 * @param keySchema Schema for Map keys
 * @param valueSchema Schema for Map values
 * @returns A schema that produces a `Map<keyOutput, valueOutput>`
 */
export declare function map<keyInput, keyOutput, valueInput, valueOutput>(keySchema: Schema<keyInput, keyOutput>, valueSchema: Schema<valueInput, valueOutput>): Schema<unknown, Map<keyOutput, valueOutput>>;
/**
 * Create a schema that accepts `null`.
 *
 * @returns A schema that produces `null`
 */
export declare function null_(): Schema<unknown, null>;
/**
 * Allow `null` as an input value, short-circuiting validation when `null` is provided.
 *
 * @param schema The wrapped schema
 * @returns A schema that accepts `null` in addition to the wrapped schema
 */
export declare function nullable<input, output>(schema: Schema<input, output>): Schema<input | null, output | null>;
/**
 * Create a schema that accepts finite numbers (excluding `NaN` and `Infinity`).
 *
 * @returns A schema that produces a `number`
 */
export declare function number(): Schema<unknown, number>;
type ObjectShape = Record<string, Schema<any, any>>;
type ObjectOptions = {
    unknownKeys?: 'strip' | 'passthrough' | 'error';
};
/**
 * Create a schema that validates an object with a fixed shape.
 *
 * By default, unknown keys are stripped. You can change this via `options.unknownKeys`.
 *
 * @param shape A mapping of keys to schemas
 * @param options Controls unknown key behavior
 * @returns A schema that produces a typed object matching the shape
 */
export declare function object<shape extends ObjectShape>(shape: shape, options?: ObjectOptions): Schema<unknown, {
    [key in keyof shape]: InferOutput<shape[key]>;
}>;
/**
 * Allow `undefined` as an input value, short-circuiting validation when `undefined` is provided.
 *
 * @param schema The wrapped schema
 * @returns A schema that accepts `undefined` in addition to the wrapped schema
 */
export declare function optional<input, output>(schema: Schema<input, output>): Schema<input | undefined, output | undefined>;
/**
 * Create a schema that validates a record (object map) by validating each key and value.
 *
 * @param keySchema Schema used to validate and transform each key
 * @param valueSchema Schema used to validate and transform each value
 * @returns A schema that produces a record of validated keys and values
 */
export declare function record<keyInput, keyOutput extends PropertyKey, valueInput, valueOutput>(keySchema: Schema<keyInput, keyOutput>, valueSchema: Schema<valueInput, valueOutput>): Schema<unknown, Record<keyOutput, valueOutput>>;
/**
 * Create a schema that validates a Set with typed values.
 *
 * @param valueSchema Schema for Set values
 * @returns A schema that produces a `Set<valueOutput>`
 */
export declare function set<valueInput, valueOutput>(valueSchema: Schema<valueInput, valueOutput>): Schema<unknown, Set<valueOutput>>;
/**
 * Create a schema that accepts strings.
 *
 * @returns A schema that produces a `string`
 */
export declare function string(): Schema<unknown, string>;
/**
 * Create a schema that accepts symbols.
 *
 * @returns A schema that produces a `symbol`
 */
export declare function symbol(): Schema<unknown, symbol>;
/**
 * Create a schema that validates a fixed-length tuple.
 *
 * @param items Schemas for each tuple position
 * @returns A schema that produces a typed tuple
 */
export declare function tuple<items extends Schema<any, any>[]>(items: items): Schema<unknown, {
    [index in keyof items]: InferOutput<items[index]>;
}>;
/**
 * Create a schema that accepts `undefined`.
 *
 * @returns A schema that produces `undefined`
 */
export declare function undefined_(): Schema<unknown, undefined>;
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
export declare function variant<key extends PropertyKey, variants extends Record<PropertyKey, Schema<any, any>>>(discriminator: key, variants: variants): Schema<unknown, InferOutput<variants[keyof variants]>>;
/**
 * Create a schema that tries multiple schemas in order and returns the first success.
 *
 * When `abortEarly` is disabled (default), issues are collected from all failing variants.
 *
 * @param schemas Candidate schemas to try
 * @returns A schema that produces the first successful variant output
 */
export declare function union<schemas extends Schema<any, any>[]>(schemas: schemas): Schema<unknown, InferOutput<schemas[number]>>;
/**
 * Error thrown by `parse()` when validation fails.
 */
export declare class ValidationError extends Error {
    /**
     * The validation issues produced by the schema.
     */
    issues: ReadonlyArray<Issue>;
    /**
     * @param issues The issues produced by schema validation
     * @param message Optional error message (defaults to "Validation failed")
     */
    constructor(issues: ReadonlyArray<Issue>, message?: string);
}
/**
 * Validate a value and return the typed output or throw a `ValidationError`.
 *
 * @param schema The schema to validate against
 * @param value The value to validate
 * @param options Validation options
 * @returns The validated output value
 * @throws {ValidationError} If validation fails
 */
export declare function parse<input, output>(schema: StandardSchemaV1<input, output>, value: unknown, options?: ParseOptions): output;
/**
 * Validate a value without throwing.
 *
 * @param schema The schema to validate against
 * @param value The value to validate
 * @param options Validation options
 * @returns A success result with the value, or a failure result with issues
 */
export declare function parseSafe<input, output>(schema: StandardSchemaV1<input, output>, value: unknown, options?: ParseOptions): {
    success: true;
    value: output;
} | {
    success: false;
    issues: ReadonlyArray<StandardSchemaV1.Issue>;
};
export {};
//# sourceMappingURL=schema.d.ts.map