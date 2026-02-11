import type { StandardSchemaV1 } from '@standard-schema/spec'

/**
 * A validation issue returned by a schema, compatible with Standard Schema v1.
 *
 * Issues include a human-readable `message` and an optional `path` that points to the
 * failing location in the input (e.g. `['user', 'email']` or `[0, 'id']`).
 */
export type Issue = StandardSchemaV1.Issue

/**
 * The result of schema validation.
 *
 * On success, `value` is present and `issues` is absent. On failure, `issues` is present.
 */
export type ValidationResult<output> = StandardSchemaV1.Result<output>

/**
 * Options passed to `~standard.validate`.
 */
export type ValidationOptions = StandardSchemaV1.Options

/**
 * Context passed to `errorMap` to customize issue messages.
 */
export type ErrorMapContext = {
  code: string
  defaultMessage: string
  path?: Issue['path']
  values?: Record<string, unknown>
  input: unknown
  locale?: string
}

/**
 * Function used to customize issue messages.
 *
 * Return `undefined` to use the default message.
 */
export type ErrorMap = (context: ErrorMapContext) => string | undefined

/**
 * Options passed to `parse` and `parseSafe`.
 *
 * This mirrors `ValidationOptions`, but also supports a convenience `abortEarly` option at the top level.
 */
export type ParseOptions = StandardSchemaV1.Options & {
  abortEarly?: boolean
  errorMap?: ErrorMap
  locale?: string
}

type SyncStandardSchemaProps<input, output> = Omit<
  StandardSchemaV1.Props<input, output>,
  'validate'
> & {
  // data-schema is sync-first; keep validate sync.
  validate: (value: unknown, options?: ValidationOptions) => ValidationResult<output>
  // Preserve Standard Schema's compile-time type channel.
  types?: StandardSchemaV1.Types<input, output> | undefined
}

type SyncStandardSchema<input, output = input> = {
  '~standard': SyncStandardSchemaProps<input, output>
}

/**
 * A reusable check for use with `schema.pipe(...)`.
 */
export type Check<output> = {
  check: (value: output) => boolean
  message?: string
  code?: string
  values?: Record<string, unknown>
}

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
  pipe: (...checks: Check<output>[]) => Schema<input, output>
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
  refine: (predicate: (value: output) => boolean, message?: string) => Schema<input, output>
  /**
   * Internal validator used to validate nested values while preserving `path`/`options`.
   */
  '~run': (value: unknown, context: ValidationContext) => ValidationResult<output>
}

/**
 * Infers the input type of a schema-like value.
 */
export type InferInput<schema> = schema extends StandardSchemaV1<infer input, any> ? input : never

/**
 * Infers the output type of a schema-like value.
 */
export type InferOutput<schema> =
  schema extends StandardSchemaV1<any, infer output> ? output : never

type ValidationContext = {
  path: NonNullable<Issue['path']>
  options?: ParseOptions
}

type IssueDescriptor = {
  code: string
  defaultMessage: string
  input: unknown
  path?: Issue['path']
  values?: Record<string, unknown>
}

export function createSchema<input, output>(
  validator: (
    value: unknown,
    context: { path: NonNullable<Issue['path']>; options?: ParseOptions },
  ) => ValidationResult<output>,
): Schema<input, output> {
  let schema: Schema<input, output> = {
    '~standard': {
      version: 1,
      vendor: 'data-schema',
      validate(value: unknown, options?: ValidationOptions) {
        return validator(value, { path: [], options })
      },
    },
    '~run'(value: unknown, context: ValidationContext) {
      return validator(value, context)
    },
    pipe(...checks: Check<output>[]) {
      if (checks.length === 0) {
        return schema
      }

      return createSchema(function validate(value, context) {
        let result = schema['~run'](value, context)

        if (result.issues) {
          return result
        }

        for (let check of checks) {
          if (!check.check(result.value)) {
            if (!check.code) {
              return { issues: [createIssue(check.message ?? 'Check failed', context.path)] }
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
            }
          }
        }

        return result
      })
    },
    refine(predicate: (value: output) => boolean, message?: string) {
      return createSchema<input, output>(function validate(value, context) {
        let result = schema['~run'](value, context)

        if (result.issues) {
          return result
        }

        if (!predicate(result.value)) {
          if (message !== undefined) {
            return { issues: [createIssue(message, context.path)] }
          }

          return {
            issues: [
              createIssueFromContext(context, {
                code: 'refine.failed',
                defaultMessage: 'Refinement failed',
                input: result.value,
              }),
            ],
          }
        }

        return result
      })
    },
  }

  return schema
}

function shouldAbortEarly(options?: ParseOptions): boolean {
  let libraryAbortEarly = (options?.libraryOptions as { abortEarly?: unknown } | undefined)
    ?.abortEarly
  let abortEarly = options?.abortEarly ?? libraryAbortEarly
  return Boolean(abortEarly)
}

function withPath(path: NonNullable<Issue['path']>, key: PropertyKey): NonNullable<Issue['path']> {
  return path.length === 0 ? [key] : [...path, key]
}

function getErrorMap(options?: ParseOptions): ErrorMap | undefined {
  let libraryErrorMap = (options?.libraryOptions as { errorMap?: unknown } | undefined)?.errorMap

  if (typeof options?.errorMap === 'function') {
    return options.errorMap
  }

  if (typeof libraryErrorMap === 'function') {
    return libraryErrorMap as ErrorMap
  }
}

function getLocale(options?: ParseOptions): string | undefined {
  let libraryLocale = (options?.libraryOptions as { locale?: unknown } | undefined)?.locale

  if (typeof options?.locale === 'string') {
    return options.locale
  }

  if (typeof libraryLocale === 'string') {
    return libraryLocale
  }
}

function resolveIssueMessage(options: ParseOptions | undefined, context: ErrorMapContext): string {
  let errorMap = getErrorMap(options)

  if (!errorMap) {
    return context.defaultMessage
  }

  let message = errorMap(context)
  return message ?? context.defaultMessage
}

function createIssueFromContext(context: ValidationContext, descriptor: IssueDescriptor): Issue {
  let path = descriptor.path ?? context.path
  let message = resolveIssueMessage(context.options, {
    code: descriptor.code,
    defaultMessage: descriptor.defaultMessage,
    path,
    values: descriptor.values,
    input: descriptor.input,
    locale: getLocale(context.options),
  })

  return createIssue(message, path)
}

export function createIssue(message: string, path: Issue['path']): Issue {
  return !path || path.length === 0 ? { message } : { message, path }
}

export function fail(
  message: string,
  path: Issue['path'],
  options?: {
    code?: string
    values?: Record<string, unknown>
    input?: unknown
    parseOptions?: ParseOptions
  },
): StandardSchemaV1.FailureResult {
  if (!options?.code) {
    return { issues: [createIssue(message, path)] }
  }

  let resolvedMessage = resolveIssueMessage(options.parseOptions, {
    code: options.code,
    defaultMessage: message,
    path,
    values: options.values,
    input: options.input,
    locale: getLocale(options.parseOptions),
  })

  return { issues: [createIssue(resolvedMessage, path)] }
}

/**
 * Create a schema that accepts any value without validation.
 *
 * @returns A schema that produces `unknown`
 */
export function any(): Schema<any, unknown> {
  return createSchema(function validate(value) {
    return { value }
  })
}

/**
 * Create a schema that validates an array by validating each element with `elementSchema`.
 *
 * @param elementSchema The schema to validate each element
 * @returns A schema that produces an array of validated outputs
 */
export function array<input, output>(
  elementSchema: Schema<input, output>,
): Schema<unknown, output[]> {
  return createSchema(function validate(value, context) {
    if (!Array.isArray(value)) {
      return fail('Expected array', context.path, {
        code: 'type.array',
        input: value,
        parseOptions: context.options,
      })
    }

    let abortEarly = shouldAbortEarly(context.options)
    let issues: Issue[] = []
    let outputValues: output[] = []
    let index = 0

    for (let item of value) {
      let result = elementSchema['~run'](item, {
        path: withPath(context.path, index),
        options: context.options,
      })

      if (result.issues) {
        if (abortEarly) {
          return result
        }

        issues.push(...result.issues)
      } else {
        outputValues.push(result.value)
      }

      index += 1
    }

    if (issues.length > 0) {
      return { issues }
    }

    return { value: outputValues }
  })
}

/**
 * Create a schema that accepts bigints.
 *
 * @returns A schema that produces a `bigint`
 */
export function bigint(): Schema<unknown, bigint> {
  return createSchema(function validate(value, context) {
    if (typeof value !== 'bigint') {
      return fail('Expected bigint', context.path, {
        code: 'type.bigint',
        input: value,
        parseOptions: context.options,
      })
    }

    return { value }
  })
}

/**
 * Create a schema that accepts booleans.
 *
 * @returns A schema that produces a `boolean`
 */
export function boolean(): Schema<unknown, boolean> {
  return createSchema(function validate(value, context) {
    if (typeof value !== 'boolean') {
      return fail('Expected boolean', context.path, {
        code: 'type.boolean',
        input: value,
        parseOptions: context.options,
      })
    }

    return { value }
  })
}

/**
 * Provide a default when the input is `undefined`.
 *
 * @param schema The wrapped schema
 * @param defaultValue A value or function used to produce the default
 * @returns A schema that produces the default when the input is `undefined`
 */
export function defaulted<input, output>(
  schema: Schema<input, output>,
  defaultValue: output | (() => output),
): Schema<input | undefined, output> {
  return createSchema(function validate(value, context) {
    if (value === undefined) {
      let resolved =
        typeof defaultValue === 'function' ? (defaultValue as () => output)() : defaultValue

      return { value: resolved }
    }

    return schema['~run'](value, context)
  })
}

/**
 * Create a schema that accepts one of the given values using strict equality (`===`).
 *
 * @param values The allowed values
 * @returns A schema that produces the union of allowed value types
 */
export function enum_<const values extends readonly [unknown, ...unknown[]]>(
  values: values,
): Schema<unknown, values[number]> {
  return createSchema(function validate(value, context) {
    for (let allowed of values) {
      if (value === allowed) {
        return { value: value as values[number] }
      }
    }

    return fail('Expected one of: ' + values.map(String).join(', '), context.path, {
      code: 'enum.invalid_value',
      input: value,
      values: { values: [...values] },
      parseOptions: context.options,
    })
  })
}

/**
 * Create a schema that validates a value is an instance of a class.
 *
 * @param constructor The class constructor to check against
 * @returns A schema that produces the instance type
 */
export function instanceof_<constructor extends abstract new (...args: any[]) => any>(
  constructor: constructor,
): Schema<unknown, InstanceType<constructor>> {
  return createSchema(function validate(value, context) {
    if (!(value instanceof constructor)) {
      return fail('Expected instance of ' + constructor.name, context.path, {
        code: 'instanceof.invalid_type',
        input: value,
        values: { constructorName: constructor.name },
        parseOptions: context.options,
      })
    }

    return { value: value as InstanceType<constructor> }
  })
}

/**
 * Create a schema that accepts a single literal value using strict equality (`===`).
 *
 * @param literalValue The literal value to match
 * @returns A schema that produces the literal type
 */
export function literal<value>(literalValue: value): Schema<unknown, value> {
  return createSchema(function validate(value, context) {
    if (value !== literalValue) {
      return fail('Expected literal value', context.path, {
        code: 'literal.invalid_value',
        input: value,
        values: { expected: literalValue },
        parseOptions: context.options,
      })
    }

    return { value: literalValue }
  })
}

/**
 * Create a schema that validates a Map with typed keys and values.
 *
 * @param keySchema Schema for Map keys
 * @param valueSchema Schema for Map values
 * @returns A schema that produces a `Map<keyOutput, valueOutput>`
 */
export function map<keyInput, keyOutput, valueInput, valueOutput>(
  keySchema: Schema<keyInput, keyOutput>,
  valueSchema: Schema<valueInput, valueOutput>,
): Schema<unknown, Map<keyOutput, valueOutput>> {
  return createSchema(function validate(value, context) {
    if (!(value instanceof Map)) {
      return fail('Expected Map', context.path, {
        code: 'type.map',
        input: value,
        parseOptions: context.options,
      })
    }

    let abortEarly = shouldAbortEarly(context.options)
    let issues: Issue[] = []
    let outputMap = new Map<keyOutput, valueOutput>()

    for (let [key, val] of value) {
      let keyResult = keySchema['~run'](key, {
        path: withPath(context.path, key),
        options: context.options,
      })

      if (keyResult.issues) {
        if (abortEarly) {
          return keyResult
        }

        issues.push(...keyResult.issues)
        continue
      }

      let valueResult = valueSchema['~run'](val, {
        path: withPath(context.path, key),
        options: context.options,
      })

      if (valueResult.issues) {
        if (abortEarly) {
          return valueResult
        }

        issues.push(...valueResult.issues)
        continue
      }

      outputMap.set(keyResult.value, valueResult.value)
    }

    if (issues.length > 0) {
      return { issues }
    }

    return { value: outputMap }
  })
}

/**
 * Create a schema that accepts `null`.
 *
 * @returns A schema that produces `null`
 */
export function null_(): Schema<unknown, null> {
  return createSchema(function validate(value, context) {
    if (value !== null) {
      return fail('Expected null', context.path, {
        code: 'type.null',
        input: value,
        parseOptions: context.options,
      })
    }

    return { value: null }
  })
}

/**
 * Allow `null` as an input value, short-circuiting validation when `null` is provided.
 *
 * @param schema The wrapped schema
 * @returns A schema that accepts `null` in addition to the wrapped schema
 */
export function nullable<input, output>(
  schema: Schema<input, output>,
): Schema<input | null, output | null> {
  return createSchema<input | null, output | null>(function validate(value, context) {
    if (value === null) {
      return { value: null }
    }

    return schema['~run'](value, context)
  })
}

/**
 * Create a schema that accepts finite numbers (excluding `NaN` and `Infinity`).
 *
 * @returns A schema that produces a `number`
 */
export function number(): Schema<unknown, number> {
  return createSchema(function validate(value, context) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return fail('Expected number', context.path, {
        code: 'type.number',
        input: value,
        parseOptions: context.options,
      })
    }

    return { value }
  })
}

type ObjectShape = Record<string, Schema<any, any>>

type ObjectOptions = {
  unknownKeys?: 'strip' | 'passthrough' | 'error'
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
export function object<shape extends ObjectShape>(
  shape: shape,
  options?: ObjectOptions,
): Schema<unknown, { [key in keyof shape]: InferOutput<shape[key]> }> {
  return createSchema(function validate(value, context) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return fail('Expected object', context.path, {
        code: 'type.object',
        input: value,
        parseOptions: context.options,
      })
    }

    let abortEarly = shouldAbortEarly(context.options)
    let issues: Issue[] = []
    let outputValues: Record<string, unknown> = {}
    let input = value as Record<string, unknown>
    let unknownKeys = options?.unknownKeys ?? 'strip'

    for (let key of Object.keys(shape)) {
      let result = shape[key]['~run'](input[key], {
        path: withPath(context.path, key),
        options: context.options,
      })

      if (result.issues) {
        if (abortEarly) {
          return result
        }

        issues.push(...result.issues)
      } else {
        if (Object.prototype.hasOwnProperty.call(input, key) || result.value !== undefined) {
          outputValues[key] = result.value
        }
      }
    }

    if (unknownKeys === 'passthrough' || unknownKeys === 'error') {
      for (let key in input) {
        if (!Object.prototype.hasOwnProperty.call(input, key)) {
          continue
        }

        if (Object.prototype.hasOwnProperty.call(shape, key)) {
          continue
        }

        if (unknownKeys === 'passthrough') {
          outputValues[key] = input[key]
        } else {
          let issue = createIssueFromContext(context, {
            code: 'object.unknown_key',
            defaultMessage: 'Unknown key',
            input: input[key],
            path: withPath(context.path, key),
            values: { key },
          })

          if (abortEarly) {
            return { issues: [issue] }
          }

          issues.push(issue)
        }
      }
    }

    if (issues.length > 0) {
      return { issues }
    }

    return { value: outputValues as { [key in keyof shape]: InferOutput<shape[key]> } }
  })
}

/**
 * Allow `undefined` as an input value, short-circuiting validation when `undefined` is provided.
 *
 * @param schema The wrapped schema
 * @returns A schema that accepts `undefined` in addition to the wrapped schema
 */
export function optional<input, output>(
  schema: Schema<input, output>,
): Schema<input | undefined, output | undefined> {
  return createSchema<input | undefined, output | undefined>(function validate(value, context) {
    if (value === undefined) {
      return { value: undefined }
    }

    return schema['~run'](value, context)
  })
}

/**
 * Create a schema that validates a record (object map) by validating each key and value.
 *
 * @param keySchema Schema used to validate and transform each key
 * @param valueSchema Schema used to validate and transform each value
 * @returns A schema that produces a record of validated keys and values
 */
export function record<keyInput, keyOutput extends PropertyKey, valueInput, valueOutput>(
  keySchema: Schema<keyInput, keyOutput>,
  valueSchema: Schema<valueInput, valueOutput>,
): Schema<unknown, Record<keyOutput, valueOutput>> {
  return createSchema(function validate(value, context) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return fail('Expected object', context.path, {
        code: 'type.object',
        input: value,
        parseOptions: context.options,
      })
    }

    let abortEarly = shouldAbortEarly(context.options)
    let issues: Issue[] = []
    let outputValues: Record<PropertyKey, valueOutput> = {}
    let input = value as Record<string, unknown>

    for (let key in input) {
      if (!Object.prototype.hasOwnProperty.call(input, key)) {
        continue
      }

      let keyResult = keySchema['~run'](key, {
        path: withPath(context.path, key),
        options: context.options,
      })

      if (keyResult.issues) {
        if (abortEarly) {
          return keyResult
        }

        issues.push(...keyResult.issues)
        continue
      }

      let valueResult = valueSchema['~run'](input[key], {
        path: withPath(context.path, key),
        options: context.options,
      })

      if (valueResult.issues) {
        if (abortEarly) {
          return valueResult
        }

        issues.push(...valueResult.issues)
        continue
      }

      outputValues[keyResult.value] = valueResult.value
    }

    if (issues.length > 0) {
      return { issues }
    }

    return { value: outputValues as Record<keyOutput, valueOutput> }
  })
}

/**
 * Create a schema that validates a Set with typed values.
 *
 * @param valueSchema Schema for Set values
 * @returns A schema that produces a `Set<valueOutput>`
 */
export function set<valueInput, valueOutput>(
  valueSchema: Schema<valueInput, valueOutput>,
): Schema<unknown, Set<valueOutput>> {
  return createSchema(function validate(value, context) {
    if (!(value instanceof Set)) {
      return fail('Expected Set', context.path, {
        code: 'type.set',
        input: value,
        parseOptions: context.options,
      })
    }

    let abortEarly = shouldAbortEarly(context.options)
    let issues: Issue[] = []
    let outputSet = new Set<valueOutput>()
    let index = 0

    for (let item of value) {
      let result = valueSchema['~run'](item, {
        path: withPath(context.path, index),
        options: context.options,
      })

      if (result.issues) {
        if (abortEarly) {
          return result
        }

        issues.push(...result.issues)
      } else {
        outputSet.add(result.value)
      }

      index++
    }

    if (issues.length > 0) {
      return { issues }
    }

    return { value: outputSet }
  })
}

/**
 * Create a schema that accepts strings.
 *
 * @returns A schema that produces a `string`
 */
export function string(): Schema<unknown, string> {
  return createSchema(function validate(value, context) {
    if (typeof value !== 'string') {
      return fail('Expected string', context.path, {
        code: 'type.string',
        input: value,
        parseOptions: context.options,
      })
    }

    return { value }
  })
}

/**
 * Create a schema that accepts symbols.
 *
 * @returns A schema that produces a `symbol`
 */
export function symbol(): Schema<unknown, symbol> {
  return createSchema(function validate(value, context) {
    if (typeof value !== 'symbol') {
      return fail('Expected symbol', context.path, {
        code: 'type.symbol',
        input: value,
        parseOptions: context.options,
      })
    }

    return { value }
  })
}

/**
 * Create a schema that validates a fixed-length tuple.
 *
 * @param items Schemas for each tuple position
 * @returns A schema that produces a typed tuple
 */
export function tuple<items extends Schema<any, any>[]>(
  items: items,
): Schema<unknown, { [index in keyof items]: InferOutput<items[index]> }> {
  return createSchema(function validate(value, context) {
    if (!Array.isArray(value)) {
      return fail('Expected array', context.path, {
        code: 'type.array',
        input: value,
        parseOptions: context.options,
      })
    }

    let abortEarly = shouldAbortEarly(context.options)
    let issues: Issue[] = []
    let outputValues: unknown[] = []

    if (value.length !== items.length) {
      let issue = createIssueFromContext(context, {
        code: 'tuple.length',
        defaultMessage: 'Expected tuple length ' + String(items.length),
        input: value,
        values: { length: items.length },
      })

      if (abortEarly) {
        return { issues: [issue] }
      }

      issues.push(issue)
    }

    let index = 0
    let max = Math.min(value.length, items.length)

    while (index < max) {
      let result = items[index]['~run'](value[index], {
        path: withPath(context.path, index),
        options: context.options,
      })

      if (result.issues) {
        if (abortEarly) {
          return result
        }

        issues.push(...result.issues)
      } else {
        outputValues[index] = result.value
      }

      index += 1
    }

    if (issues.length > 0) {
      return { issues }
    }

    return { value: outputValues as { [index in keyof items]: InferOutput<items[index]> } }
  })
}

/**
 * Create a schema that accepts `undefined`.
 *
 * @returns A schema that produces `undefined`
 */
export function undefined_(): Schema<unknown, undefined> {
  return createSchema(function validate(value, context) {
    if (value !== undefined) {
      return fail('Expected undefined', context.path, {
        code: 'type.undefined',
        input: value,
        parseOptions: context.options,
      })
    }

    return { value: undefined }
  })
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
export function variant<
  key extends PropertyKey,
  variants extends Record<PropertyKey, Schema<any, any>>,
>(discriminator: key, variants: variants): Schema<unknown, InferOutput<variants[keyof variants]>> {
  return createSchema(function validate(value, context) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return fail('Expected object', context.path, {
        code: 'type.object',
        input: value,
        parseOptions: context.options,
      })
    }

    let input = value as Record<PropertyKey, unknown>
    let tag = input[discriminator]

    if (tag === undefined) {
      return fail('Expected discriminator', [...context.path, discriminator], {
        code: 'variant.missing_discriminator',
        input: value,
        values: { discriminator: String(discriminator) },
        parseOptions: context.options,
      })
    }

    if (typeof tag !== 'string' && typeof tag !== 'number' && typeof tag !== 'symbol') {
      return fail('Unknown discriminator', [...context.path, discriminator], {
        code: 'variant.unknown_discriminator',
        input: tag,
        values: { discriminator: String(discriminator) },
        parseOptions: context.options,
      })
    }

    if (!Object.prototype.hasOwnProperty.call(variants, tag)) {
      return fail('Unknown discriminator', [...context.path, discriminator], {
        code: 'variant.unknown_discriminator',
        input: tag,
        values: { discriminator: String(discriminator) },
        parseOptions: context.options,
      })
    }

    let schema = variants[tag as keyof variants]
    return schema['~run'](value, context)
  })
}

/**
 * Create a schema that tries multiple schemas in order and returns the first success.
 *
 * When `abortEarly` is disabled (default), issues are collected from all failing variants.
 *
 * @param schemas Candidate schemas to try
 * @returns A schema that produces the first successful variant output
 */
export function union<schemas extends Schema<any, any>[]>(
  schemas: schemas,
): Schema<unknown, InferOutput<schemas[number]>> {
  return createSchema(function validate(value, context) {
    if (schemas.length === 0) {
      return fail('No union variant matched', context.path, {
        code: 'union.no_variants',
        input: value,
        parseOptions: context.options,
      })
    }

    let abortEarly = shouldAbortEarly(context.options)
    let issues: Issue[] = []

    for (let schema of schemas) {
      let result = schema['~run'](value, context)

      if (result.issues) {
        if (abortEarly) {
          return { issues: result.issues }
        }

        issues.push(...result.issues)

        continue
      }

      return result
    }

    return { issues }
  })
}

/**
 * Error thrown by `parse()` when validation fails.
 */
export class ValidationError extends Error {
  /**
   * The validation issues produced by the schema.
   */
  issues: ReadonlyArray<Issue>

  /**
   * @param issues The issues produced by schema validation
   * @param message Optional error message (defaults to "Validation failed")
   */
  constructor(issues: ReadonlyArray<Issue>, message = 'Validation failed') {
    super(message)
    this.name = 'ValidationError'
    this.issues = issues
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
export function parse<input, output>(
  schema: StandardSchemaV1<input, output>,
  value: unknown,
  options?: ParseOptions,
): output {
  let result = schema['~standard'].validate(value, options) as ValidationResult<output>

  if (result.issues) {
    throw new ValidationError(result.issues)
  }

  return result.value
}

/**
 * Validate a value without throwing.
 *
 * @param schema The schema to validate against
 * @param value The value to validate
 * @param options Validation options
 * @returns A success result with the value, or a failure result with issues
 */
export function parseSafe<input, output>(
  schema: StandardSchemaV1<input, output>,
  value: unknown,
  options?: ParseOptions,
):
  | { success: true; value: output }
  | { success: false; issues: ReadonlyArray<StandardSchemaV1.Issue> } {
  let result = schema['~standard'].validate(value, options) as ValidationResult<output>

  if (result.issues) {
    return { success: false, issues: result.issues }
  }

  return { success: true, value: result.value }
}
