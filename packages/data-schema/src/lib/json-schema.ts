import type { Check, Schema, SchemaDef } from './schema.ts'

/**
 * A JSON Schema dialect that {@link toJSONSchema} knows how to emit.
 */
export type JSONSchemaTarget = 'draft-2020-12' | 'draft-07'

/**
 * Whether to describe the values a schema accepts or the values it produces.
 *
 * These differ for `defaulted` (an input may omit the key, an output never does),
 * for objects that strip unknown keys, and for `transform` (whose output cannot be
 * described at all).
 */
export type JSONSchemaIO = 'input' | 'output'

/**
 * Options for {@link toJSONSchema}.
 */
export type ToJSONSchemaOptions = {
  /**
   * Describe accepted values (`'input'`, the default) or produced values (`'output'`).
   */
  io?: JSONSchemaIO
  /**
   * The JSON Schema dialect to emit. Defaults to `'draft-2020-12'`.
   */
  target?: JSONSchemaTarget
}

/**
 * Error thrown when a schema has no sound JSON Schema representation.
 *
 * Rather than dropping a constraint it cannot express, the emitter throws and names both
 * the schema and the path at which it was found.
 */
export class JSONSchemaError extends Error {
  /**
   * The path from the root schema to the node that could not be emitted.
   */
  path: PropertyKey[]

  /**
   * @param message A description of what could not be emitted
   * @param path The path to the offending node
   */
  constructor(message: string, path: PropertyKey[]) {
    super(message + ' at ' + formatPath(path))
    this.name = 'JSONSchemaError'
    this.path = path
  }
}

// The strings each coercion accepts, as `String.prototype.trim` plus the grammar the
// underlying conversion uses. Regex `\s` matches exactly what `trim` strips.
const COERCE_NUMBER_PATTERN =
  '^\\s*([+-]?([0-9]+(\\.[0-9]*)?|\\.[0-9]+)([eE][+-]?[0-9]+)?|0[xX][0-9a-fA-F]+|0[bB][01]+|0[oO][0-7]+)\\s*$'
const COERCE_BIGINT_PATTERN = '^\\s*([+-]?[0-9]+|0[xX][0-9a-fA-F]+|0[bB][01]+|0[oO][0-7]+)\\s*$'
const COERCE_BOOLEAN_PATTERN = '^\\s*([Tt][Rr][Uu][Ee]|[Ff][Aa][Ll][Ss][Ee])\\s*$'

type JSONSchemaNode = Record<string, unknown>

type Context = {
  io: JSONSchemaIO
  target: JSONSchemaTarget
  path: PropertyKey[]
  stack: Set<Schema<any, any>>
}

/**
 * Convert a schema into a JSON Schema document.
 *
 * The result describes the values the schema accepts, so a single declaration can both
 * validate input and be published to consumers that speak JSON Schema.
 *
 * Schemas with no sound representation throw a {@link JSONSchemaError} instead of silently
 * dropping the constraint. Attach an explicit fragment with `schema.meta({ jsonSchema })` to
 * describe such a schema yourself.
 *
 * @param schema The schema to convert
 * @param options Controls the dialect and whether to describe input or output values
 * @returns A JSON Schema object
 * @throws {JSONSchemaError} If the schema cannot be represented
 */
export function toJSONSchema(
  schema: Schema<any, any>,
  options?: ToJSONSchemaOptions,
): JSONSchemaNode {
  let target = options?.target ?? 'draft-2020-12'

  if (target !== 'draft-2020-12' && target !== 'draft-07') {
    throw new JSONSchemaError('Unsupported JSON Schema target "' + String(target) + '"', [])
  }

  return emit(schema, {
    io: options?.io ?? 'input',
    target,
    path: [],
    stack: new Set(),
  })
}

function emit(schema: Schema<any, any>, context: Context): JSONSchemaNode {
  if (context.stack.has(schema)) {
    throw new JSONSchemaError(
      'Cannot emit JSON Schema for a recursive schema, because $ref is not supported',
      context.path,
    )
  }

  context.stack.add(schema)

  try {
    return emitNode(schema, context)
  } finally {
    context.stack.delete(schema)
  }
}

function emitNode(schema: Schema<any, any>, context: Context): JSONSchemaNode {
  let def = schema['~def']
  let override = def.meta?.jsonSchema
  let node: JSONSchemaNode

  if (override) {
    node = { ...tryEmitBase(def, context), ...override }
  } else {
    if (def.refined) {
      throw new JSONSchemaError(
        'Cannot emit JSON Schema for a refined schema, because a predicate has no representation',
        context.path,
      )
    }

    if (def.transformed && context.io === 'output') {
      throw new JSONSchemaError(
        'Cannot emit an output JSON Schema for a transformed schema, because a transform has no representation',
        context.path,
      )
    }

    node = { ...emitKind(def, context), ...emitChecks(def.checks, context) }
  }

  if (def.meta?.title !== undefined) {
    node.title = def.meta.title
  }

  if (def.meta?.description !== undefined) {
    node.description = def.meta.description
  }

  return node
}

function tryEmitBase(def: SchemaDef, context: Context): JSONSchemaNode {
  try {
    return { ...emitKind(def, context), ...emitChecks(def.checks, context) }
  } catch {
    return {}
  }
}

function emitKind(def: SchemaDef, context: Context): JSONSchemaNode {
  switch (def.kind) {
    case 'any':
      return {}
    case 'string':
      return { type: 'string' }
    case 'number':
      return { type: 'number' }
    case 'boolean':
      return { type: 'boolean' }
    case 'null':
      return { type: 'null' }
    case 'literal':
      return { const: assertJSONValue(def.value, 'a literal', context) }
    case 'enum':
      return emitEnum(def.values, context)
    case 'array':
      return { type: 'array', items: emit(def.element, context) }
    case 'tuple':
      return emitTuple(def.items, context)
    case 'object':
      return emitObject(def.entries, def.unknownKeys, context)
    case 'record':
      return emitRecord(def.key, def.value, context)
    case 'union':
      return { anyOf: def.members.map((member) => emit(member, context)) }
    case 'variant':
      return {
        oneOf: Object.values(def.variants).map((member) => emit(member, context)),
        discriminator: { propertyName: String(def.discriminator) },
      }
    case 'optional':
      return emit(def.source, context)
    case 'nullable':
      return addNull(emit(def.source, context))
    case 'defaulted':
      return emitDefaulted(def.source, def.value, context)
    case 'lazy':
      return emit(def.resolve(), context)
    case 'coerce':
      return emitCoerce(def.to, context)
    default:
      throw new JSONSchemaError(unrepresentable(def.kind), context.path)
  }
}

function unrepresentable(kind: string): string {
  switch (kind) {
    case 'bigint':
      return 'Cannot emit JSON Schema for `bigint`, because JSON has no bigint type'
    case 'symbol':
      return 'Cannot emit JSON Schema for `symbol`, because JSON has no symbol type'
    case 'undefined':
      return 'Cannot emit JSON Schema for `undefined`, because JSON has no undefined value'
    case 'map':
      return 'Cannot emit JSON Schema for `map`, because a Map instance is not JSON data'
    case 'set':
      return 'Cannot emit JSON Schema for `set`, because a Set instance is not JSON data'
    case 'instanceof':
      return 'Cannot emit JSON Schema for `instanceof_`, because a class instance is not JSON data'
    case 'formData':
      return 'Cannot emit JSON Schema for a form data schema, because FormData is not JSON data'
    default:
      return 'Cannot emit JSON Schema for a schema built with `createSchema` without a definition'
  }
}

function emitEnum(values: readonly unknown[], context: Context): JSONSchemaNode {
  let members = values.map((value) => assertJSONValue(value, 'an enum value', context))
  let types = new Set(members.map(jsonTypeOf))

  if (types.size === 1) {
    return { type: [...types][0], enum: members }
  }

  return { enum: members }
}

function emitTuple(items: Schema<any, any>[], context: Context): JSONSchemaNode {
  let positional = items.map((item, index) =>
    emit(item, { ...context, path: [...context.path, index] }),
  )

  // `items: false` bounds the length from above but not from below, and a tuple schema
  // requires every position to be present.
  if (context.target === 'draft-07') {
    return { type: 'array', items: positional, additionalItems: false, minItems: items.length }
  }

  return { type: 'array', prefixItems: positional, items: false, minItems: items.length }
}

function emitObject(
  entries: Record<string, Schema<any, any>>,
  unknownKeys: 'strip' | 'passthrough' | 'error',
  context: Context,
): JSONSchemaNode {
  let properties: JSONSchemaNode = {}
  let required: string[] = []

  for (let key of Object.keys(entries)) {
    let entry = entries[key]

    properties[key] = emit(entry, { ...context, path: [...context.path, key] })

    if (isRequired(entry, context.io)) {
      required.push(key)
    }
  }

  let node: JSONSchemaNode = { type: 'object', properties }

  if (required.length > 0) {
    node.required = required
  }

  // `strip` accepts unknown keys but never produces them, so it is only closed on output.
  if (unknownKeys === 'error' || (unknownKeys === 'strip' && context.io === 'output')) {
    node.additionalProperties = false
  }

  return node
}

function isRequired(schema: Schema<any, any>, io: JSONSchemaIO): boolean {
  let kind = schema['~def'].kind

  if (kind === 'optional') {
    return false
  }

  if (kind === 'defaulted') {
    return io === 'output'
  }

  return true
}

function emitRecord(
  key: Schema<any, any>,
  value: Schema<any, any>,
  context: Context,
): JSONSchemaNode {
  let node: JSONSchemaNode = { type: 'object', additionalProperties: emit(value, context) }
  let keyDef = key['~def']

  // JSON object keys are always strings, so an unconstrained string key adds nothing.
  if (keyDef.kind !== 'string' || keyDef.checks.length > 0 || keyDef.meta !== undefined) {
    node.propertyNames = emit(key, context)
  }

  return node
}

function emitDefaulted(source: Schema<any, any>, value: unknown, context: Context): JSONSchemaNode {
  let node = emit(source, context)

  if (context.io === 'output') {
    return node
  }

  // A factory has no single value to annotate with, and calling it would make emission
  // non-deterministic.
  if (typeof value === 'function') {
    return node
  }

  return { ...node, default: assertJSONValue(value, 'a default value', context) }
}

function emitCoerce(
  to: 'bigint' | 'boolean' | 'date' | 'number' | 'string',
  context: Context,
): JSONSchemaNode {
  if (to === 'date') {
    throw new JSONSchemaError(
      'Cannot emit JSON Schema for `coerce.date`, because `new Date(value)` accepts a host-defined set of strings',
      context.path,
    )
  }

  if (context.io === 'output') {
    if (to === 'bigint') {
      throw new JSONSchemaError(
        'Cannot emit an output JSON Schema for `coerce.bigint`, because JSON has no bigint type',
        context.path,
      )
    }

    return { type: to }
  }

  // A coercion accepts a specific set of strings, so the emitted schema has to constrain
  // them. `pattern` is ignored for instances that are not strings.
  switch (to) {
    case 'number':
      return { type: ['number', 'string'], pattern: COERCE_NUMBER_PATTERN }
    case 'boolean':
      return { type: ['boolean', 'string'], pattern: COERCE_BOOLEAN_PATTERN }
    case 'bigint':
      return { type: ['integer', 'string'], pattern: COERCE_BIGINT_PATTERN }
    case 'string':
      return { type: ['string', 'number', 'boolean'] }
  }
}

function addNull(node: JSONSchemaNode): JSONSchemaNode {
  // An empty schema already accepts null.
  if (Object.keys(node).length === 0) {
    return node
  }

  // `type` cannot widen an enumerated set of values, so fall back to a union.
  if ('enum' in node || 'const' in node) {
    return { anyOf: [node, { type: 'null' }] }
  }

  let type = node.type

  if (typeof type === 'string') {
    return { ...node, type: [type, 'null'] }
  }

  if (Array.isArray(type)) {
    return type.includes('null') ? node : { ...node, type: [...type, 'null'] }
  }

  return { anyOf: [node, { type: 'null' }] }
}

function emitChecks(checks: Check<any>[], context: Context): JSONSchemaNode {
  let node: JSONSchemaNode = {}

  for (let check of checks) {
    Object.assign(node, emitCheck(check, context))
  }

  return node
}

function emitCheck(check: Check<any>, context: Context): JSONSchemaNode {
  let values = check.values ?? {}

  switch (check.code) {
    case 'string.min_length':
      return { minLength: values.min }
    case 'string.max_length':
      return { maxLength: values.max }
    case 'string.email':
      return { format: 'email' }
    case 'string.url':
      return { format: 'uri' }
    case 'number.min':
      return { minimum: values.min }
    case 'number.max':
      return { maximum: values.max }
    default:
      throw new JSONSchemaError(
        'Cannot emit JSON Schema for check "' +
          (check.code ?? check.message ?? 'unknown') +
          '", because it has no known representation',
        context.path,
      )
  }
}

function jsonTypeOf(value: unknown): string {
  if (value === null) {
    return 'null'
  }

  if (Array.isArray(value)) {
    return 'array'
  }

  return typeof value === 'object' ? 'object' : typeof value
}

function assertJSONValue<value>(value: value, what: string, context: Context): value {
  if (!isJSONValue(value)) {
    throw new JSONSchemaError(
      'Cannot emit JSON Schema for ' + what + ' that is not JSON data',
      context.path,
    )
  }

  return value
}

function isJSONValue(value: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
  }

  if (Array.isArray(value)) {
    return value.every(isJSONValue)
  }

  if (typeof value === 'object') {
    let prototype = Object.getPrototypeOf(value)

    if (prototype !== Object.prototype && prototype !== null) {
      return false
    }

    return Object.values(value as Record<string, unknown>).every(isJSONValue)
  }

  return false
}

function formatPath(path: PropertyKey[]): string {
  if (path.length === 0) {
    return '<root>'
  }

  return path.map((key) => String(key)).join('.')
}
