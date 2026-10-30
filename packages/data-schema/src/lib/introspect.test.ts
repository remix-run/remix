import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { minLength, url } from './checks.ts'
import { coerceNumber } from './coerce.ts'
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
  record,
  set,
  string,
  symbol,
  tuple,
  undefined_,
  union,
  variant,
} from './schema.ts'

describe('schema introspection', () => {
  it('reports the kind of every constructor', () => {
    assert.equal(any()['~def'].kind, 'any')
    assert.equal(array(string())['~def'].kind, 'array')
    assert.equal(bigint()['~def'].kind, 'bigint')
    assert.equal(boolean()['~def'].kind, 'boolean')
    assert.equal(defaulted(string(), 'a')['~def'].kind, 'defaulted')
    assert.equal(enum_(['a'])['~def'].kind, 'enum')
    assert.equal(instanceof_(Date)['~def'].kind, 'instanceof')
    assert.equal(literal('a')['~def'].kind, 'literal')
    assert.equal(map(string(), string())['~def'].kind, 'map')
    assert.equal(null_()['~def'].kind, 'null')
    assert.equal(nullable(string())['~def'].kind, 'nullable')
    assert.equal(number()['~def'].kind, 'number')
    assert.equal(object({})['~def'].kind, 'object')
    assert.equal(optional(string())['~def'].kind, 'optional')
    assert.equal(record(string(), string())['~def'].kind, 'record')
    assert.equal(set(string())['~def'].kind, 'set')
    assert.equal(string()['~def'].kind, 'string')
    assert.equal(symbol()['~def'].kind, 'symbol')
    assert.equal(tuple([string()])['~def'].kind, 'tuple')
    assert.equal(undefined_()['~def'].kind, 'undefined')
    assert.equal(union([string()])['~def'].kind, 'union')
    assert.equal(variant('k', { a: object({}) })['~def'].kind, 'variant')
  })

  it('reports the kind of lazy, coerce and bare schemas', () => {
    assert.equal(lazy(() => string())['~def'].kind, 'lazy')
    assert.equal(coerceNumber()['~def'].kind, 'coerce')
    assert.equal(createSchema(() => ({ value: 1 }))['~def'].kind, 'unknown')
  })

  it('exposes object entries', () => {
    let name = string()
    let age = number()
    let def = object({ name, age })['~def']

    assert.equal(def.kind, 'object')
    assert.ok(def.kind === 'object')
    assert.deepEqual(Object.keys(def.entries), ['name', 'age'])
    assert.equal(def.entries.name, name)
    assert.equal(def.entries.age, age)
  })

  it('distinguishes optional properties from required ones', () => {
    let def = object({ required: string(), maybe: optional(string()) })['~def']

    assert.ok(def.kind === 'object')
    assert.equal(def.entries.required['~def'].kind, 'string')
    assert.equal(def.entries.maybe['~def'].kind, 'optional')
  })

  it('exposes the unknown key behavior of an object', () => {
    assert.ok(object({})['~def'].kind === 'object')
    assert.equal((object({})['~def'] as { unknownKeys: string }).unknownKeys, 'strip')
    assert.equal(
      (object({}, { unknownKeys: 'error' })['~def'] as { unknownKeys: string }).unknownKeys,
      'error',
    )
  })

  it('exposes the element schema of array, set and record', () => {
    let element = string()

    assert.equal((array(element)['~def'] as { element: unknown }).element, element)
    assert.equal((set(element)['~def'] as { element: unknown }).element, element)

    let key = string()
    let recordDef = record(key, element)['~def']

    assert.ok(recordDef.kind === 'record')
    assert.equal(recordDef.key, key)
    assert.equal(recordDef.value, element)
  })

  it('exposes tuple positions in order', () => {
    let first = string()
    let second = number()
    let def = tuple([first, second])['~def']

    assert.ok(def.kind === 'tuple')
    assert.deepEqual(def.items, [first, second])
  })

  it('exposes enum and literal values', () => {
    let enumDef = enum_(['a', 'b'])['~def']
    assert.ok(enumDef.kind === 'enum')
    assert.deepEqual([...enumDef.values], ['a', 'b'])

    let literalDef = literal(42)['~def']
    assert.ok(literalDef.kind === 'literal')
    assert.equal(literalDef.value, 42)
  })

  it('exposes union members', () => {
    let first = string()
    let second = number()
    let def = union([first, second])['~def']

    assert.ok(def.kind === 'union')
    assert.deepEqual(def.members, [first, second])
  })

  it('exposes variant members and the discriminator', () => {
    let a = object({ kind: literal('a') })
    let def = variant('kind', { a })['~def']

    assert.ok(def.kind === 'variant')
    assert.equal(def.discriminator, 'kind')
    assert.equal(def.variants.a, a)
  })

  it('exposes what optional and nullable wrap', () => {
    let source = string()

    assert.equal((optional(source)['~def'] as { source: unknown }).source, source)
    assert.equal((nullable(source)['~def'] as { source: unknown }).source, source)
  })

  it('exposes the default value of a defaulted schema', () => {
    let source = number()
    let def = defaulted(source, 10)['~def']

    assert.ok(def.kind === 'defaulted')
    assert.equal(def.source, source)
    assert.equal(def.value, 10)
  })

  it('exposes the wrapped constructor of instanceof_', () => {
    let def = instanceof_(Date)['~def']

    assert.ok(def.kind === 'instanceof')
    assert.equal(def.constructor, Date)
  })

  it('resolves what a lazy schema wraps', () => {
    let inner = string()
    let def = lazy(() => inner)['~def']

    assert.ok(def.kind === 'lazy')
    assert.equal(def.resolve(), inner)
  })

  it('keeps checks readable after pipe, in order', () => {
    let def = string().pipe(minLength(1), url())['~def']

    assert.equal(def.checks.length, 2)
    assert.equal(def.checks[0].code, 'string.min_length')
    assert.deepEqual(def.checks[0].values, { min: 1 })
    assert.equal(def.checks[1].code, 'string.url')
  })

  it('accumulates checks across chained pipe calls', () => {
    let def = string().pipe(minLength(1)).pipe(url())['~def']

    assert.deepEqual(
      def.checks.map((check) => check.code),
      ['string.min_length', 'string.url'],
    )
  })

  it('reports refine and transform', () => {
    assert.equal(string()['~def'].refined, false)
    assert.equal(string()['~def'].transformed, false)
    assert.equal(string().refine(() => true)['~def'].refined, true)
    assert.equal(string().transform((value) => value.length)['~def'].transformed, true)
  })

  it('still reports the underlying kind after pipe, refine and transform', () => {
    let schema = string()
      .pipe(minLength(1))
      .refine(() => true)
      .transform((value) => value.length)

    assert.equal(schema['~def'].kind, 'string')
    assert.equal(schema['~def'].checks.length, 1)
    assert.equal(schema['~def'].refined, true)
    assert.equal(schema['~def'].transformed, true)
  })

  it('does not call the validator', () => {
    let schema = createSchema(
      function validate() {
        throw new Error('validator should not run')
      },
      { kind: 'string' },
    )

    assert.equal(schema['~def'].kind, 'string')
  })
})

describe('schema.meta', () => {
  it('carries a title and a description', () => {
    let schema = string().meta({ title: 'Name', description: 'A name.' })

    assert.equal(schema['~def'].meta?.title, 'Name')
    assert.equal(schema['~def'].meta?.description, 'A name.')
  })

  it('merges with metadata already present', () => {
    let schema = string().meta({ title: 'Name' }).meta({ description: 'A name.' })

    assert.equal(schema['~def'].meta?.title, 'Name')
    assert.equal(schema['~def'].meta?.description, 'A name.')
  })

  it('survives pipe, refine and transform', () => {
    let schema = string()
      .meta({ title: 'Name', description: 'A name.' })
      .pipe(minLength(1))
      .refine(() => true)
      .transform((value) => value.length)

    assert.equal(schema['~def'].meta?.title, 'Name')
    assert.equal(schema['~def'].meta?.description, 'A name.')
  })

  it('does not change validation behavior', () => {
    let schema = string().meta({ description: 'A name.' })

    assert.deepEqual(schema['~standard'].validate('a'), { value: 'a' })
    assert.ok(schema['~standard'].validate(1).issues)
  })
})
