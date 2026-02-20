export function createSchema(validator) {
    let schema = {
        '~standard': {
            version: 1,
            vendor: 'data-schema',
            validate(value, options) {
                return validator(value, { path: [], options });
            },
        },
        '~run'(value, context) {
            return validator(value, context);
        },
        pipe(...checks) {
            if (checks.length === 0) {
                return schema;
            }
            return createSchema(function validate(value, context) {
                let result = schema['~run'](value, context);
                if (result.issues) {
                    return result;
                }
                for (let check of checks) {
                    if (!check.check(result.value)) {
                        if (!check.code) {
                            return { issues: [createIssue(check.message ?? 'Check failed', context.path)] };
                        }
                        return {
                            issues: [
                                createIssueFromContext(context, {
                                    code: check.code,
                                    defaultMessage: check.message ?? 'Check failed',
                                    input: result.value,
                                    values: check.values,
                                }),
                            ],
                        };
                    }
                }
                return result;
            });
        },
        refine(predicate, message) {
            return createSchema(function validate(value, context) {
                let result = schema['~run'](value, context);
                if (result.issues) {
                    return result;
                }
                if (!predicate(result.value)) {
                    if (message !== undefined) {
                        return { issues: [createIssue(message, context.path)] };
                    }
                    return {
                        issues: [
                            createIssueFromContext(context, {
                                code: 'refine.failed',
                                defaultMessage: 'Refinement failed',
                                input: result.value,
                            }),
                        ],
                    };
                }
                return result;
            });
        },
    };
    return schema;
}
function shouldAbortEarly(options) {
    let libraryAbortEarly = options?.libraryOptions
        ?.abortEarly;
    let abortEarly = options?.abortEarly ?? libraryAbortEarly;
    return Boolean(abortEarly);
}
function withPath(path, key) {
    return path.length === 0 ? [key] : [...path, key];
}
function getErrorMap(options) {
    let libraryErrorMap = options?.libraryOptions?.errorMap;
    if (typeof options?.errorMap === 'function') {
        return options.errorMap;
    }
    if (typeof libraryErrorMap === 'function') {
        return libraryErrorMap;
    }
}
function getLocale(options) {
    let libraryLocale = options?.libraryOptions?.locale;
    if (typeof options?.locale === 'string') {
        return options.locale;
    }
    if (typeof libraryLocale === 'string') {
        return libraryLocale;
    }
}
function resolveIssueMessage(options, context) {
    let errorMap = getErrorMap(options);
    if (!errorMap) {
        return context.defaultMessage;
    }
    let message = errorMap(context);
    return message ?? context.defaultMessage;
}
function createIssueFromContext(context, descriptor) {
    let path = descriptor.path ?? context.path;
    let message = resolveIssueMessage(context.options, {
        code: descriptor.code,
        defaultMessage: descriptor.defaultMessage,
        path,
        values: descriptor.values,
        input: descriptor.input,
        locale: getLocale(context.options),
    });
    return createIssue(message, path);
}
export function createIssue(message, path) {
    return !path || path.length === 0 ? { message } : { message, path };
}
export function fail(message, path, options) {
    if (!options?.code) {
        return { issues: [createIssue(message, path)] };
    }
    let resolvedMessage = resolveIssueMessage(options.parseOptions, {
        code: options.code,
        defaultMessage: message,
        path,
        values: options.values,
        input: options.input,
        locale: getLocale(options.parseOptions),
    });
    return { issues: [createIssue(resolvedMessage, path)] };
}
/**
 * Create a schema that accepts any value without validation.
 *
 * @returns A schema that produces `unknown`
 */
export function any() {
    return createSchema(function validate(value) {
        return { value };
    });
}
/**
 * Create a schema that validates an array by validating each element with `elementSchema`.
 *
 * @param elementSchema The schema to validate each element
 * @returns A schema that produces an array of validated outputs
 */
export function array(elementSchema) {
    return createSchema(function validate(value, context) {
        if (!Array.isArray(value)) {
            return fail('Expected array', context.path, {
                code: 'type.array',
                input: value,
                parseOptions: context.options,
            });
        }
        let abortEarly = shouldAbortEarly(context.options);
        let issues = [];
        let outputValues = [];
        let index = 0;
        for (let item of value) {
            let result = elementSchema['~run'](item, {
                path: withPath(context.path, index),
                options: context.options,
            });
            if (result.issues) {
                if (abortEarly) {
                    return result;
                }
                issues.push(...result.issues);
            }
            else {
                outputValues.push(result.value);
            }
            index += 1;
        }
        if (issues.length > 0) {
            return { issues };
        }
        return { value: outputValues };
    });
}
/**
 * Create a schema that accepts bigints.
 *
 * @returns A schema that produces a `bigint`
 */
export function bigint() {
    return createSchema(function validate(value, context) {
        if (typeof value !== 'bigint') {
            return fail('Expected bigint', context.path, {
                code: 'type.bigint',
                input: value,
                parseOptions: context.options,
            });
        }
        return { value };
    });
}
/**
 * Create a schema that accepts booleans.
 *
 * @returns A schema that produces a `boolean`
 */
export function boolean() {
    return createSchema(function validate(value, context) {
        if (typeof value !== 'boolean') {
            return fail('Expected boolean', context.path, {
                code: 'type.boolean',
                input: value,
                parseOptions: context.options,
            });
        }
        return { value };
    });
}
/**
 * Provide a default when the input is `undefined`.
 *
 * @param schema The wrapped schema
 * @param defaultValue A value or function used to produce the default
 * @returns A schema that produces the default when the input is `undefined`
 */
export function defaulted(schema, defaultValue) {
    return createSchema(function validate(value, context) {
        if (value === undefined) {
            let resolved = typeof defaultValue === 'function' ? defaultValue() : defaultValue;
            return { value: resolved };
        }
        return schema['~run'](value, context);
    });
}
/**
 * Create a schema that accepts one of the given values using strict equality (`===`).
 *
 * @param values The allowed values
 * @returns A schema that produces the union of allowed value types
 */
export function enum_(values) {
    return createSchema(function validate(value, context) {
        for (let allowed of values) {
            if (value === allowed) {
                return { value: value };
            }
        }
        return fail('Expected one of: ' + values.map(String).join(', '), context.path, {
            code: 'enum.invalid_value',
            input: value,
            values: { values: [...values] },
            parseOptions: context.options,
        });
    });
}
/**
 * Create a schema that validates a value is an instance of a class.
 *
 * @param constructor The class constructor to check against
 * @returns A schema that produces the instance type
 */
export function instanceof_(constructor) {
    return createSchema(function validate(value, context) {
        if (!(value instanceof constructor)) {
            return fail('Expected instance of ' + constructor.name, context.path, {
                code: 'instanceof.invalid_type',
                input: value,
                values: { constructorName: constructor.name },
                parseOptions: context.options,
            });
        }
        return { value: value };
    });
}
/**
 * Create a schema that accepts a single literal value using strict equality (`===`).
 *
 * @param literalValue The literal value to match
 * @returns A schema that produces the literal type
 */
export function literal(literalValue) {
    return createSchema(function validate(value, context) {
        if (value !== literalValue) {
            return fail('Expected literal value', context.path, {
                code: 'literal.invalid_value',
                input: value,
                values: { expected: literalValue },
                parseOptions: context.options,
            });
        }
        return { value: literalValue };
    });
}
/**
 * Create a schema that validates a Map with typed keys and values.
 *
 * @param keySchema Schema for Map keys
 * @param valueSchema Schema for Map values
 * @returns A schema that produces a `Map<keyOutput, valueOutput>`
 */
export function map(keySchema, valueSchema) {
    return createSchema(function validate(value, context) {
        if (!(value instanceof Map)) {
            return fail('Expected Map', context.path, {
                code: 'type.map',
                input: value,
                parseOptions: context.options,
            });
        }
        let abortEarly = shouldAbortEarly(context.options);
        let issues = [];
        let outputMap = new Map();
        for (let [key, val] of value) {
            let keyResult = keySchema['~run'](key, {
                path: withPath(context.path, key),
                options: context.options,
            });
            if (keyResult.issues) {
                if (abortEarly) {
                    return keyResult;
                }
                issues.push(...keyResult.issues);
                continue;
            }
            let valueResult = valueSchema['~run'](val, {
                path: withPath(context.path, key),
                options: context.options,
            });
            if (valueResult.issues) {
                if (abortEarly) {
                    return valueResult;
                }
                issues.push(...valueResult.issues);
                continue;
            }
            outputMap.set(keyResult.value, valueResult.value);
        }
        if (issues.length > 0) {
            return { issues };
        }
        return { value: outputMap };
    });
}
/**
 * Create a schema that accepts `null`.
 *
 * @returns A schema that produces `null`
 */
export function null_() {
    return createSchema(function validate(value, context) {
        if (value !== null) {
            return fail('Expected null', context.path, {
                code: 'type.null',
                input: value,
                parseOptions: context.options,
            });
        }
        return { value: null };
    });
}
/**
 * Allow `null` as an input value, short-circuiting validation when `null` is provided.
 *
 * @param schema The wrapped schema
 * @returns A schema that accepts `null` in addition to the wrapped schema
 */
export function nullable(schema) {
    return createSchema(function validate(value, context) {
        if (value === null) {
            return { value: null };
        }
        return schema['~run'](value, context);
    });
}
/**
 * Create a schema that accepts finite numbers (excluding `NaN` and `Infinity`).
 *
 * @returns A schema that produces a `number`
 */
export function number() {
    return createSchema(function validate(value, context) {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            return fail('Expected number', context.path, {
                code: 'type.number',
                input: value,
                parseOptions: context.options,
            });
        }
        return { value };
    });
}
/**
 * Create a schema that validates an object with a fixed shape.
 *
 * By default, unknown keys are stripped. You can change this via `options.unknownKeys`.
 *
 * @param shape A mapping of keys to schemas
 * @param options Controls unknown key behavior
 * @returns A schema that produces a typed object matching the shape
 */
export function object(shape, options) {
    return createSchema(function validate(value, context) {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            return fail('Expected object', context.path, {
                code: 'type.object',
                input: value,
                parseOptions: context.options,
            });
        }
        let abortEarly = shouldAbortEarly(context.options);
        let issues = [];
        let outputValues = {};
        let input = value;
        let unknownKeys = options?.unknownKeys ?? 'strip';
        for (let key of Object.keys(shape)) {
            let result = shape[key]['~run'](input[key], {
                path: withPath(context.path, key),
                options: context.options,
            });
            if (result.issues) {
                if (abortEarly) {
                    return result;
                }
                issues.push(...result.issues);
            }
            else {
                if (Object.prototype.hasOwnProperty.call(input, key) || result.value !== undefined) {
                    outputValues[key] = result.value;
                }
            }
        }
        if (unknownKeys === 'passthrough' || unknownKeys === 'error') {
            for (let key in input) {
                if (!Object.prototype.hasOwnProperty.call(input, key)) {
                    continue;
                }
                if (Object.prototype.hasOwnProperty.call(shape, key)) {
                    continue;
                }
                if (unknownKeys === 'passthrough') {
                    outputValues[key] = input[key];
                }
                else {
                    let issue = createIssueFromContext(context, {
                        code: 'object.unknown_key',
                        defaultMessage: 'Unknown key',
                        input: input[key],
                        path: withPath(context.path, key),
                        values: { key },
                    });
                    if (abortEarly) {
                        return { issues: [issue] };
                    }
                    issues.push(issue);
                }
            }
        }
        if (issues.length > 0) {
            return { issues };
        }
        return { value: outputValues };
    });
}
/**
 * Allow `undefined` as an input value, short-circuiting validation when `undefined` is provided.
 *
 * @param schema The wrapped schema
 * @returns A schema that accepts `undefined` in addition to the wrapped schema
 */
export function optional(schema) {
    return createSchema(function validate(value, context) {
        if (value === undefined) {
            return { value: undefined };
        }
        return schema['~run'](value, context);
    });
}
/**
 * Create a schema that validates a record (object map) by validating each key and value.
 *
 * @param keySchema Schema used to validate and transform each key
 * @param valueSchema Schema used to validate and transform each value
 * @returns A schema that produces a record of validated keys and values
 */
export function record(keySchema, valueSchema) {
    return createSchema(function validate(value, context) {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            return fail('Expected object', context.path, {
                code: 'type.object',
                input: value,
                parseOptions: context.options,
            });
        }
        let abortEarly = shouldAbortEarly(context.options);
        let issues = [];
        let outputValues = {};
        let input = value;
        for (let key in input) {
            if (!Object.prototype.hasOwnProperty.call(input, key)) {
                continue;
            }
            let keyResult = keySchema['~run'](key, {
                path: withPath(context.path, key),
                options: context.options,
            });
            if (keyResult.issues) {
                if (abortEarly) {
                    return keyResult;
                }
                issues.push(...keyResult.issues);
                continue;
            }
            let valueResult = valueSchema['~run'](input[key], {
                path: withPath(context.path, key),
                options: context.options,
            });
            if (valueResult.issues) {
                if (abortEarly) {
                    return valueResult;
                }
                issues.push(...valueResult.issues);
                continue;
            }
            outputValues[keyResult.value] = valueResult.value;
        }
        if (issues.length > 0) {
            return { issues };
        }
        return { value: outputValues };
    });
}
/**
 * Create a schema that validates a Set with typed values.
 *
 * @param valueSchema Schema for Set values
 * @returns A schema that produces a `Set<valueOutput>`
 */
export function set(valueSchema) {
    return createSchema(function validate(value, context) {
        if (!(value instanceof Set)) {
            return fail('Expected Set', context.path, {
                code: 'type.set',
                input: value,
                parseOptions: context.options,
            });
        }
        let abortEarly = shouldAbortEarly(context.options);
        let issues = [];
        let outputSet = new Set();
        let index = 0;
        for (let item of value) {
            let result = valueSchema['~run'](item, {
                path: withPath(context.path, index),
                options: context.options,
            });
            if (result.issues) {
                if (abortEarly) {
                    return result;
                }
                issues.push(...result.issues);
            }
            else {
                outputSet.add(result.value);
            }
            index++;
        }
        if (issues.length > 0) {
            return { issues };
        }
        return { value: outputSet };
    });
}
/**
 * Create a schema that accepts strings.
 *
 * @returns A schema that produces a `string`
 */
export function string() {
    return createSchema(function validate(value, context) {
        if (typeof value !== 'string') {
            return fail('Expected string', context.path, {
                code: 'type.string',
                input: value,
                parseOptions: context.options,
            });
        }
        return { value };
    });
}
/**
 * Create a schema that accepts symbols.
 *
 * @returns A schema that produces a `symbol`
 */
export function symbol() {
    return createSchema(function validate(value, context) {
        if (typeof value !== 'symbol') {
            return fail('Expected symbol', context.path, {
                code: 'type.symbol',
                input: value,
                parseOptions: context.options,
            });
        }
        return { value };
    });
}
/**
 * Create a schema that validates a fixed-length tuple.
 *
 * @param items Schemas for each tuple position
 * @returns A schema that produces a typed tuple
 */
export function tuple(items) {
    return createSchema(function validate(value, context) {
        if (!Array.isArray(value)) {
            return fail('Expected array', context.path, {
                code: 'type.array',
                input: value,
                parseOptions: context.options,
            });
        }
        let abortEarly = shouldAbortEarly(context.options);
        let issues = [];
        let outputValues = [];
        if (value.length !== items.length) {
            let issue = createIssueFromContext(context, {
                code: 'tuple.length',
                defaultMessage: 'Expected tuple length ' + String(items.length),
                input: value,
                values: { length: items.length },
            });
            if (abortEarly) {
                return { issues: [issue] };
            }
            issues.push(issue);
        }
        let index = 0;
        let max = Math.min(value.length, items.length);
        while (index < max) {
            let result = items[index]['~run'](value[index], {
                path: withPath(context.path, index),
                options: context.options,
            });
            if (result.issues) {
                if (abortEarly) {
                    return result;
                }
                issues.push(...result.issues);
            }
            else {
                outputValues[index] = result.value;
            }
            index += 1;
        }
        if (issues.length > 0) {
            return { issues };
        }
        return { value: outputValues };
    });
}
/**
 * Create a schema that accepts `undefined`.
 *
 * @returns A schema that produces `undefined`
 */
export function undefined_() {
    return createSchema(function validate(value, context) {
        if (value !== undefined) {
            return fail('Expected undefined', context.path, {
                code: 'type.undefined',
                input: value,
                parseOptions: context.options,
            });
        }
        return { value: undefined };
    });
}
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
export function variant(discriminator, variants) {
    return createSchema(function validate(value, context) {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            return fail('Expected object', context.path, {
                code: 'type.object',
                input: value,
                parseOptions: context.options,
            });
        }
        let input = value;
        let tag = input[discriminator];
        if (tag === undefined) {
            return fail('Expected discriminator', [...context.path, discriminator], {
                code: 'variant.missing_discriminator',
                input: value,
                values: { discriminator: String(discriminator) },
                parseOptions: context.options,
            });
        }
        if (typeof tag !== 'string' && typeof tag !== 'number' && typeof tag !== 'symbol') {
            return fail('Unknown discriminator', [...context.path, discriminator], {
                code: 'variant.unknown_discriminator',
                input: tag,
                values: { discriminator: String(discriminator) },
                parseOptions: context.options,
            });
        }
        if (!Object.prototype.hasOwnProperty.call(variants, tag)) {
            return fail('Unknown discriminator', [...context.path, discriminator], {
                code: 'variant.unknown_discriminator',
                input: tag,
                values: { discriminator: String(discriminator) },
                parseOptions: context.options,
            });
        }
        let schema = variants[tag];
        return schema['~run'](value, context);
    });
}
/**
 * Create a schema that tries multiple schemas in order and returns the first success.
 *
 * When `abortEarly` is disabled (default), issues are collected from all failing variants.
 *
 * @param schemas Candidate schemas to try
 * @returns A schema that produces the first successful variant output
 */
export function union(schemas) {
    return createSchema(function validate(value, context) {
        if (schemas.length === 0) {
            return fail('No union variant matched', context.path, {
                code: 'union.no_variants',
                input: value,
                parseOptions: context.options,
            });
        }
        let abortEarly = shouldAbortEarly(context.options);
        let issues = [];
        for (let schema of schemas) {
            let result = schema['~run'](value, context);
            if (result.issues) {
                if (abortEarly) {
                    return { issues: result.issues };
                }
                issues.push(...result.issues);
                continue;
            }
            return result;
        }
        return { issues };
    });
}
/**
 * Error thrown by `parse()` when validation fails.
 */
export class ValidationError extends Error {
    /**
     * The validation issues produced by the schema.
     */
    issues;
    /**
     * @param issues The issues produced by schema validation
     * @param message Optional error message (defaults to "Validation failed")
     */
    constructor(issues, message = 'Validation failed') {
        super(message);
        this.name = 'ValidationError';
        this.issues = issues;
    }
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
export function parse(schema, value, options) {
    let result = schema['~standard'].validate(value, options);
    if (result.issues) {
        throw new ValidationError(result.issues);
    }
    return result.value;
}
/**
 * Validate a value without throwing.
 *
 * @param schema The schema to validate against
 * @param value The value to validate
 * @param options Validation options
 * @returns A success result with the value, or a failure result with issues
 */
export function parseSafe(schema, value, options) {
    let result = schema['~standard'].validate(value, options);
    if (result.issues) {
        return { success: false, issues: result.issues };
    }
    return { success: true, value: result.value };
}
