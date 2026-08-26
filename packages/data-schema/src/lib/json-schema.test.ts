import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import type { StandardJSONSchemaV1 } from '@standard-schema/spec'
import { Ajv2020 } from 'ajv/dist/2020.js'

import { email, max, maxLength, min, minLength, url } from './checks.ts'
import { coerceDate, coerceNumber } from './coerce.ts'
import { JSONSchemaError, toJSONSchema } from './json-schema.ts'
import { lazy } from './lazy.ts'
import {
  any,
  array,
  bigint,
  boolean,
  createSchema,
  defaulted,
  enum_,
  instanceof_,
  literal,
  map,
  null_,
  nullable,
  number,
  object,
  optional,
  parseSafe,
  record,
  set,
  string,
  symbol,
  tuple,
  undefined_,
  union,
  variant,
} from './schema.ts'
import type { Schema } from './schema.ts'

describe('toJSONSchema', () => {
  it('emits a string', () => {
    assert.deepEqual(toJSONSchema(string()), { type: 'string' })
  })

  it('emits a number', () => {
    assert.deepEqual(toJSONSchema(number()), { type: 'number' })
  })

  it('emits a boolean', () => {
    assert.deepEqual(toJSONSchema(boolean()), { type: 'boolean' })
  })

  it('emits null', () => {
    assert.deepEqual(toJSONSchema(null_()), { type: 'null' })
  })

  it('emits an empty schema for any', () => {
    assert.deepEqual(toJSONSchema(any()), {})
  })

  it('emits a literal as const', () => {
    assert.deepEqual(toJSONSchema(literal('a')), { const: 'a' })
  })

  it('emits an enum with its type', () => {
    assert.deepEqual(toJSONSchema(enum_(['a', 'b'])), { type: 'string', enum: ['a', 'b'] })
  })

  it('omits the type for an enum of mixed types', () => {
    assert.deepEqual(toJSONSchema(enum_(['a', 1])), { enum: ['a', 1] })
  })

  it('emits an array', () => {
    assert.deepEqual(toJSONSchema(array(string())), {
      type: 'array',
      items: { type: 'string' },
    })
  })

  it('emits a tuple with prefixItems', () => {
    assert.deepEqual(toJSONSchema(tuple([string(), number()])), {
      type: 'array',
      prefixItems: [{ type: 'string' }, { type: 'number' }],
      items: false,
      minItems: 2,
    })
  })

  it('emits an object', () => {
    assert.deepEqual(toJSONSchema(object({ a: string() })), {
      type: 'object',
      properties: { a: { type: 'string' } },
      required: ['a'],
    })
  })

  it('emits a record', () => {
    assert.deepEqual(toJSONSchema(record(string(), number())), {
      type: 'object',
      additionalProperties: { type: 'number' },
    })
  })

  it('emits propertyNames for a constrained record key', () => {
    assert.deepEqual(toJSONSchema(record(string().pipe(minLength(2)), number())), {
      type: 'object',
      additionalProperties: { type: 'number' },
      propertyNames: { type: 'string', minLength: 2 },
    })
  })

  it('omits an optional property from required', () => {
    assert.deepEqual(toJSONSchema(object({ a: optional(string()) })), {
      type: 'object',
      properties: { a: { type: 'string' } },
    })
  })

  it('adds null to the type of a nullable schema', () => {
    assert.deepEqual(toJSONSchema(nullable(string())), { type: ['string', 'null'] })
  })

  it('unions a nullable enum rather than widening its type', () => {
    assert.deepEqual(toJSONSchema(nullable(enum_(['a']))), {
      anyOf: [{ type: 'string', enum: ['a'] }, { type: 'null' }],
    })
  })

  it('emits a default and omits the key from required', () => {
    assert.deepEqual(toJSONSchema(object({ a: defaulted(number(), 10) })), {
      type: 'object',
      properties: { a: { type: 'number', default: 10 } },
    })
  })

  it('omits default for a factory default', () => {
    assert.deepEqual(toJSONSchema(defaulted(number(), () => 10)), { type: 'number' })
  })

  it('emits a union as anyOf', () => {
    assert.deepEqual(toJSONSchema(union([string(), number()])), {
      anyOf: [{ type: 'string' }, { type: 'number' }],
    })
  })

  it('emits a variant as oneOf with a discriminator', () => {
    let schema = variant('k', { a: object({ k: literal('a') }) })

    assert.deepEqual(toJSONSchema(schema), {
      oneOf: [
        {
          type: 'object',
          properties: { k: { const: 'a' } },
          required: ['k'],
        },
      ],
      discriminator: { propertyName: 'k' },
    })
  })

  it('closes an object that rejects unknown keys', () => {
    assert.deepEqual(toJSONSchema(object({ a: string() }, { unknownKeys: 'error' })), {
      type: 'object',
      properties: { a: { type: 'string' } },
      required: ['a'],
      additionalProperties: false,
    })
  })

  it('resolves a non-recursive lazy schema', () => {
    assert.deepEqual(toJSONSchema(lazy(() => string())), { type: 'string' })
  })

  it('is pure', () => {
    let schema = object({ a: string() })

    assert.deepEqual(toJSONSchema(schema), toJSONSchema(schema))
    assert.notEqual(toJSONSchema(schema), toJSONSchema(schema))
  })
})

describe('toJSONSchema checks', () => {
  it('emits minLength', () => {
    assert.deepEqual(toJSONSchema(string().pipe(minLength(1))), { type: 'string', minLength: 1 })
  })

  it('emits maxLength', () => {
    assert.deepEqual(toJSONSchema(string().pipe(maxLength(5))), { type: 'string', maxLength: 5 })
  })

  it('emits minimum', () => {
    assert.deepEqual(toJSONSchema(number().pipe(min(1))), { type: 'number', minimum: 1 })
  })

  it('emits maximum', () => {
    assert.deepEqual(toJSONSchema(number().pipe(max(9))), { type: 'number', maximum: 9 })
  })

  it('emits the uri format', () => {
    assert.deepEqual(toJSONSchema(string().pipe(url())), { type: 'string', format: 'uri' })
  })

  it('emits the email format', () => {
    assert.deepEqual(toJSONSchema(string().pipe(email())), { type: 'string', format: 'email' })
  })

  it('emits several checks at once', () => {
    assert.deepEqual(toJSONSchema(string().pipe(minLength(1), maxLength(5))), {
      type: 'string',
      minLength: 1,
      maxLength: 5,
    })
  })

  it('throws rather than dropping an unknown check', () => {
    let schema = string().pipe({ check: (value) => value !== '', message: 'not empty' })

    assert.throws(() => toJSONSchema(schema), JSONSchemaError)
  })
})

describe('toJSONSchema metadata', () => {
  it('emits a description', () => {
    assert.deepEqual(toJSONSchema(string().meta({ description: 'A name.' })), {
      type: 'string',
      description: 'A name.',
    })
  })

  it('emits a title', () => {
    assert.deepEqual(toJSONSchema(string().meta({ title: 'Name' })), {
      type: 'string',
      title: 'Name',
    })
  })

  it('emits metadata on the node that carries it', () => {
    assert.deepEqual(toJSONSchema(object({ a: string().meta({ description: 'A.' }) })), {
      type: 'object',
      properties: { a: { type: 'string', description: 'A.' } },
      required: ['a'],
    })
  })
})

describe('toJSONSchema escape hatch', () => {
  it('emits a refined schema when given an explicit fragment', () => {
    let schema = string()
      .refine((value) => value.startsWith('a'))
      .meta({ jsonSchema: { pattern: '^a' } })

    assert.deepEqual(toJSONSchema(schema), { type: 'string', pattern: '^a' })
  })

  it('emits an otherwise unrepresentable schema', () => {
    let schema = set(string()).meta({
      jsonSchema: { type: 'array', items: { type: 'string' }, uniqueItems: true },
    })

    assert.deepEqual(toJSONSchema(schema), {
      type: 'array',
      items: { type: 'string' },
      uniqueItems: true,
    })
  })

  it('wins over what the emitter derives', () => {
    assert.deepEqual(toJSONSchema(string().meta({ jsonSchema: { type: 'integer' } })), {
      type: 'integer',
    })
  })
})

describe('toJSONSchema failures', () => {
  it('throws for bigint', () => {
    assert.throws(() => toJSONSchema(bigint()), JSONSchemaError)
  })

  it('throws for symbol', () => {
    assert.throws(() => toJSONSchema(symbol()), JSONSchemaError)
  })

  it('throws for undefined', () => {
    assert.throws(() => toJSONSchema(undefined_()), JSONSchemaError)
  })

  it('throws for map', () => {
    assert.throws(() => toJSONSchema(map(string(), string())), JSONSchemaError)
  })

  it('throws for set', () => {
    assert.throws(() => toJSONSchema(set(string())), JSONSchemaError)
  })

  it('throws for instanceof_', () => {
    assert.throws(() => toJSONSchema(instanceof_(Date)), JSONSchemaError)
  })

  it('throws for refine', () => {
    assert.throws(() => toJSONSchema(string().refine(() => true)), JSONSchemaError)
  })

  it('throws for a schema built without a definition', () => {
    let schema = createSchema<unknown, number>(() => ({ value: 1 }))

    assert.throws(() => toJSONSchema(schema), JSONSchemaError)
  })

  it('throws for a recursive schema', () => {
    type Node = { children: Node[] }
    let node: Schema<unknown, Node> = object({
      children: array(lazy(() => node)),
    }) as Schema<unknown, Node>

    assert.throws(() => toJSONSchema(node), JSONSchemaError)
  })

  it('throws for an unsupported target', () => {
    assert.throws(() => toJSONSchema(string(), { target: 'openapi-3.0' as never }), JSONSchemaError)
  })

  it('names the path where the failure was found', () => {
    let schema = object({ outer: object({ inner: bigint() }) })

    try {
      toJSONSchema(schema)
      assert.fail('expected a JSONSchemaError')
    } catch (error) {
      assert.ok(error instanceof JSONSchemaError)
      assert.deepEqual(error.path, ['outer', 'inner'])
      assert.ok(error.message.includes('outer.inner'))
    }
  })
})

describe('toJSONSchema input and output', () => {
  it('marks a defaulted key required on output but not on input', () => {
    let schema = object({ a: defaulted(number(), 10) })

    assert.deepEqual(toJSONSchema(schema, { io: 'input' }), {
      type: 'object',
      properties: { a: { type: 'number', default: 10 } },
    })
    assert.deepEqual(toJSONSchema(schema, { io: 'output' }), {
      type: 'object',
      properties: { a: { type: 'number' } },
      required: ['a'],
      additionalProperties: false,
    })
  })

  it('closes a stripping object on output only', () => {
    let schema = object({ a: string() })

    assert.equal('additionalProperties' in toJSONSchema(schema, { io: 'input' }), false)
    assert.equal(toJSONSchema(schema, { io: 'output' }).additionalProperties, false)
  })

  it('emits the input of a transformed schema but not its output', () => {
    let schema = string().transform((value) => value.length)

    assert.deepEqual(toJSONSchema(schema, { io: 'input' }), { type: 'string' })
    assert.throws(() => toJSONSchema(schema, { io: 'output' }), JSONSchemaError)
  })

  it('describes what a coercion accepts and produces', () => {
    assert.deepEqual(toJSONSchema(coerceNumber(), { io: 'input' }), {
      type: ['number', 'string'],
    })
    assert.deepEqual(toJSONSchema(coerceNumber(), { io: 'output' }), { type: 'number' })
    assert.throws(() => toJSONSchema(coerceDate(), { io: 'output' }), JSONSchemaError)
  })
})

describe('toJSONSchema draft-07', () => {
  it('emits a tuple with an items array', () => {
    assert.deepEqual(toJSONSchema(tuple([string()]), { target: 'draft-07' }), {
      type: 'array',
      items: [{ type: 'string' }],
      additionalItems: false,
      minItems: 1,
    })
  })

  it('emits other types the same way as 2020-12', () => {
    assert.deepEqual(toJSONSchema(object({ a: string() }), { target: 'draft-07' }), {
      type: 'object',
      properties: { a: { type: 'string' } },
      required: ['a'],
    })
  })
})

describe('Standard JSON Schema v1', () => {
  it('exposes an input converter', () => {
    let schema = object({ a: defaulted(number(), 10) })

    assert.deepEqual(schema['~standard'].jsonSchema.input({ target: 'draft-2020-12' }), {
      type: 'object',
      properties: { a: { type: 'number', default: 10 } },
    })
  })

  it('exposes an output converter', () => {
    let schema = object({ a: defaulted(number(), 10) })

    assert.deepEqual(schema['~standard'].jsonSchema.output({ target: 'draft-2020-12' }), {
      type: 'object',
      properties: { a: { type: 'number' } },
      required: ['a'],
      additionalProperties: false,
    })
  })

  it('supports draft-07 and throws for other targets', () => {
    let schema = string()

    assert.deepEqual(schema['~standard'].jsonSchema.input({ target: 'draft-07' }), {
      type: 'string',
    })
    assert.throws(() => schema['~standard'].jsonSchema.input({ target: 'openapi-3.0' }))
  })

  it('satisfies the Standard JSON Schema interface', () => {
    let schema = string() satisfies StandardJSONSchemaV1
    let nested = object({ a: string() }) satisfies StandardJSONSchemaV1

    assert.equal(typeof schema['~standard'].jsonSchema.input, 'function')
    assert.equal(typeof nested['~standard'].jsonSchema.output, 'function')
  })

  it('keeps the rest of the standard properties intact', () => {
    let schema = string()

    assert.equal(schema['~standard'].version, 1)
    assert.equal(schema['~standard'].vendor, 'data-schema')
    assert.deepEqual(schema['~standard'].validate('a'), { value: 'a' })
  })
})

describe('the worked example', () => {
  it('emits the documented schema', () => {
    let schema = object({
      query: string()
        .pipe(minLength(1), maxLength(200))
        .meta({ description: 'Words to look for.' }),
      kind: optional(enum_(['article', 'tutorial'])).meta({ description: 'Restrict to one kind.' }),
      limit: defaulted(number().pipe(min(1), max(50)), 10).meta({ description: 'How many.' }),
    })

    assert.deepEqual(toJSONSchema(schema), {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          minLength: 1,
          maxLength: 200,
          description: 'Words to look for.',
        },
        kind: {
          type: 'string',
          enum: ['article', 'tutorial'],
          description: 'Restrict to one kind.',
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 50,
          default: 10,
          description: 'How many.',
        },
      },
      required: ['query'],
    })
  })

  it('still supplies the default when parsing', () => {
    let schema = object({
      limit: defaulted(number().pipe(min(1), max(50)), 10),
    })

    assert.deepEqual(parseSafe(schema, {}), { success: true, value: { limit: 10 } })
  })
})

const ajv = new Ajv2020({ strict: false })

function assertAgrees(schema: Schema<any, any>, samples: [unknown, boolean][]): void {
  let validate = ajv.compile(toJSONSchema(schema))

  for (let [value, expected] of samples) {
    let parsed = parseSafe(schema, value).success
    let validated = validate(value)

    assert.equal(parsed, expected, 'parse disagreed with the table for ' + JSON.stringify(value))
    assert.equal(
      validated,
      expected,
      'JSON Schema disagreed with the table for ' + JSON.stringify(value),
    )
  }
}

describe('agreement with a JSON Schema validator', () => {
  it('agrees for strings', () => {
    assertAgrees(string(), [
      ['a', true],
      ['', true],
      [1, false],
      [null, false],
    ])
  })

  it('agrees for constrained strings', () => {
    assertAgrees(string().pipe(minLength(2), maxLength(4)), [
      ['ab', true],
      ['abcd', true],
      ['a', false],
      ['abcde', false],
    ])
  })

  it('agrees for numbers', () => {
    assertAgrees(number().pipe(min(1), max(9)), [
      [1, true],
      [9, true],
      [0, false],
      [10, false],
      ['5', false],
    ])
  })

  it('agrees for booleans and null', () => {
    assertAgrees(boolean(), [
      [true, true],
      [false, true],
      ['true', false],
    ])
    assertAgrees(null_(), [
      [null, true],
      [0, false],
    ])
  })

  it('agrees for literals and enums', () => {
    assertAgrees(literal('a'), [
      ['a', true],
      ['b', false],
    ])
    assertAgrees(enum_(['a', 'b']), [
      ['a', true],
      ['b', true],
      ['c', false],
      [1, false],
    ])
  })

  it('agrees for arrays', () => {
    assertAgrees(array(string()), [
      [[], true],
      [['a'], true],
      [['a', 1], false],
      ['a', false],
    ])
  })

  it('agrees for tuples', () => {
    assertAgrees(tuple([string(), number()]), [
      [['a', 1], true],
      [['a'], false],
      [['a', 1, 2], false],
      [[1, 'a'], false],
    ])
  })

  it('agrees for objects', () => {
    assertAgrees(object({ a: string(), b: optional(number()) }), [
      [{ a: 'x' }, true],
      [{ a: 'x', b: 1 }, true],
      [{ a: 'x', extra: true }, true],
      [{}, false],
      [{ a: 1 }, false],
      [[], false],
    ])
  })

  it('agrees for closed objects', () => {
    assertAgrees(object({ a: string() }, { unknownKeys: 'error' }), [
      [{ a: 'x' }, true],
      [{ a: 'x', extra: true }, false],
    ])
  })

  it('agrees for defaulted properties', () => {
    assertAgrees(object({ a: defaulted(number(), 10) }), [
      [{}, true],
      [{ a: 1 }, true],
      [{ a: 'x' }, false],
    ])
  })

  it('agrees for nullable schemas', () => {
    assertAgrees(nullable(string()), [
      ['a', true],
      [null, true],
      [1, false],
    ])
  })

  it('agrees for nullable enums', () => {
    assertAgrees(nullable(enum_(['a'])), [
      ['a', true],
      [null, true],
      ['b', false],
    ])
  })

  it('agrees for records', () => {
    assertAgrees(record(string(), number()), [
      [{}, true],
      [{ a: 1 }, true],
      [{ a: 'x' }, false],
    ])
  })

  it('agrees for unions', () => {
    assertAgrees(union([string(), number()]), [
      ['a', true],
      [1, true],
      [true, false],
    ])
  })

  it('agrees for nested objects', () => {
    assertAgrees(object({ user: object({ name: string().pipe(minLength(1)) }) }), [
      [{ user: { name: 'a' } }, true],
      [{ user: { name: '' } }, false],
      [{ user: {} }, false],
      [{}, false],
    ])
  })

  it('agrees for any', () => {
    assertAgrees(any(), [
      ['a', true],
      [1, true],
      [null, true],
    ])
  })
})
