import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  any,
  array,
  bigint,
  boolean,
  defaulted,
  enum_,
  instanceof_,
  literal,
  map,
  null_,
  number,
  object,
  optional,
  record,
  nullable,
  set,
  string,
  symbol,
  tuple,
  undefined_,
  union,
} from './schema.ts'
import { minLength } from './checks.ts'
import type { Issue, ValidationResult } from './schema.ts'

function assertSuccess<output>(
  result: ValidationResult<output>,
): asserts result is { value: output } {
  assert.ok(!result.issues)
}

function assertFailure<output>(
  result: ValidationResult<output>,
): asserts result is { issues: ReadonlyArray<Issue> } {
  assert.ok(result.issues)
}

describe('primitives', () => {
  it('validates strings', () => {
    let schema = string()
    let result = schema['~standard'].validate('ok')

    assertSuccess(result)
    assert.equal(result.value, 'ok')
  })

  it('rejects non-strings', () => {
    let schema = string()
    let result = schema['~standard'].validate(123)

    assertFailure(result)
    assert.equal(result.issues.length, 1)
    assert.equal(result.issues[0].message, 'Expected string')
  })

  it('validates numbers and rejects NaN', () => {
    let schema = number()
    let ok = schema['~standard'].validate(42)

    assertSuccess(ok)
    assert.equal(ok.value, 42)

    let bad = schema['~standard'].validate(Number.NaN)
    assertFailure(bad)
  })

  it('validates booleans', () => {
    let schema = boolean()
    let result = schema['~standard'].validate(true)

    assertSuccess(result)
    assert.equal(result.value, true)
  })

  it('validates null and undefined', () => {
    let nullSchema = null_()
    let undefinedSchema = undefined_()

    let nullResult = nullSchema['~standard'].validate(null)
    let undefinedResult = undefinedSchema['~standard'].validate(undefined)

    assertSuccess(nullResult)
    assert.equal(nullResult.value, null)
    assertSuccess(undefinedResult)
    assert.equal(undefinedResult.value, undefined)
  })

  it('validates literals', () => {
    let schema = literal('yes')
    let ok = schema['~standard'].validate('yes')
    let bad = schema['~standard'].validate('no')

    assertSuccess(ok)
    assert.equal(ok.value, 'yes')
    assertFailure(bad)
  })

  it('validates bigints', () => {
    let schema = bigint()
    let ok = schema['~standard'].validate(BigInt(42))
    let bad = schema['~standard'].validate(42)

    assertSuccess(ok)
    assert.equal(ok.value, BigInt(42))
    assertFailure(bad)
  })

  it('validates symbols', () => {
    let mySymbol = Symbol('test')
    let schema = symbol()
    let ok = schema['~standard'].validate(mySymbol)
    let bad = schema['~standard'].validate('symbol')

    assertSuccess(ok)
    assert.equal(ok.value, mySymbol)
    assertFailure(bad)
  })

  it('rejects Infinity and -Infinity for numbers', () => {
    let schema = number()

    let posInf = schema['~standard'].validate(Infinity)
    let negInf = schema['~standard'].validate(-Infinity)

    assertFailure(posInf)
    assertFailure(negInf)
  })

  it('rejects non-booleans', () => {
    let schema = boolean()
    let bad = schema['~standard'].validate('true')

    assertFailure(bad)
    assert.equal(bad.issues[0].message, 'Expected boolean')
  })

  it('rejects non-null for null_ schema', () => {
    let schema = null_()
    let bad = schema['~standard'].validate(undefined)

    assertFailure(bad)
    assert.equal(bad.issues[0].message, 'Expected null')
  })

  it('rejects non-undefined for undefined_ schema', () => {
    let schema = undefined_()
    let bad = schema['~standard'].validate(null)

    assertFailure(bad)
    assert.equal(bad.issues[0].message, 'Expected undefined')
  })
})

describe('array', () => {
  it('validates array elements and provides paths', () => {
    let schema = array(string())
    let result = schema['~standard'].validate(['ok', 123])

    assertFailure(result)
    assert.deepEqual(result.issues[0].path, [1])
  })

  it('returns validated array on success', () => {
    let schema = array(number())
    let result = schema['~standard'].validate([1, 2, 3])

    assertSuccess(result)
    assert.deepEqual(result.value, [1, 2, 3])
  })

  it('rejects non-array values', () => {
    let schema = array(string())
    let result = schema['~standard'].validate({ 0: 'a', length: 1 })

    assertFailure(result)
    assert.equal(result.issues[0].message, 'Expected array')
  })

  it('collects all issues by default', () => {
    let schema = array(number())
    let result = schema['~standard'].validate(['a', 'b', 'c'])

    assertFailure(result)
    assert.equal(result.issues.length, 3)
  })

  it('returns first issue when abortEarly is enabled', () => {
    let schema = array(number())
    let result = schema['~standard'].validate(['a', 'b', 'c'], {
      libraryOptions: { abortEarly: true },
    })

    assertFailure(result)
    assert.equal(result.issues.length, 1)
    assert.deepEqual(result.issues[0].path, [0])
  })
})

describe('object', () => {
  it('strips unknown keys by default', () => {
    let schema = object({ name: string() })
    let result = schema['~standard'].validate({ name: 'Ada', extra: 'x' })

    assertSuccess(result)
    assert.deepEqual(result.value, { name: 'Ada' })
  })

  it('passes through unknown keys when configured', () => {
    let schema = object({ name: string() }, { unknownKeys: 'passthrough' })
    let result = schema['~standard'].validate({ name: 'Ada', extra: 'x' })

    assertSuccess(result)
    assert.deepEqual(result.value, { name: 'Ada', extra: 'x' })
  })

  it('errors on unknown keys when configured', () => {
    let schema = object({ name: string() }, { unknownKeys: 'error' })
    let result = schema['~standard'].validate({ name: 'Ada', extra: 'x' })

    assertFailure(result)
    assert.deepEqual(result.issues[0].path, ['extra'])
  })

  it('rejects non-object values', () => {
    let schema = object({ name: string() })

    let stringResult = schema['~standard'].validate('not-object')
    let arrayResult = schema['~standard'].validate(['a', 'b'])
    let nullResult = schema['~standard'].validate(null)

    assertFailure(stringResult)
    assertFailure(arrayResult)
    assertFailure(nullResult)
    assert.equal(stringResult.issues[0].message, 'Expected object')
  })

  it('validates nested objects with paths', () => {
    let schema = object({
      user: object({
        profile: object({
          email: string(),
        }),
      }),
    })

    let result = schema['~standard'].validate({
      user: { profile: { email: 123 } },
    })

    assertFailure(result)
    assert.deepEqual(result.issues[0].path, ['user', 'profile', 'email'])
  })

  it('collects all issues by default', () => {
    let schema = object({ name: string(), age: number() })
    let result = schema['~standard'].validate({ name: 123, age: 'x' })

    assertFailure(result)
    assert.equal(result.issues.length, 2)
  })

  it('returns first issue when abortEarly is enabled', () => {
    let schema = object({ name: string(), age: number() })
    let result = schema['~standard'].validate(
      { name: 123, age: 'x' },
      { libraryOptions: { abortEarly: true } },
    )

    assertFailure(result)
    assert.equal(result.issues.length, 1)
  })

  it('handles missing keys by passing undefined to schema', () => {
    let schema = object({ name: string(), age: optional(number()) })
    let result = schema['~standard'].validate({ name: 'Ada' })

    assertSuccess(result)
    assert.deepEqual(result.value, { name: 'Ada' })
  })

  it('does not include undefined values unless present in input', () => {
    let schema = object({ a: optional(string()), b: string() })
    let result = schema['~standard'].validate({ b: 'hello' })

    assertSuccess(result)
    assert.ok(!('a' in result.value))
  })
})

describe('modifiers', () => {
  it('supports optional values', () => {
    let schema = optional(string())
    let result = schema['~standard'].validate(undefined)

    assertSuccess(result)
    assert.equal(result.value, undefined)
  })

  it('optional still validates non-undefined values', () => {
    let schema = optional(string())
    let ok = schema['~standard'].validate('hello')
    let bad = schema['~standard'].validate(123)

    assertSuccess(ok)
    assertFailure(bad)
  })

  it('supports defaulted values', () => {
    let schema = defaulted(string(), 'hello')
    let result = schema['~standard'].validate(undefined)

    assertSuccess(result)
    assert.equal(result.value, 'hello')
  })

  it('supports defaulted with function', () => {
    let callCount = 0
    let schema = defaulted(number(), () => {
      callCount += 1
      return callCount
    })

    let result1 = schema['~standard'].validate(undefined)
    let result2 = schema['~standard'].validate(undefined)

    assertSuccess(result1)
    assertSuccess(result2)
    assert.equal(result1.value, 1)
    assert.equal(result2.value, 2)
  })

  it('defaulted still validates non-undefined values', () => {
    let schema = defaulted(number(), 0)
    let ok = schema['~standard'].validate(42)
    let bad = schema['~standard'].validate('not-a-number')

    assertSuccess(ok)
    assert.equal(ok.value, 42)
    assertFailure(bad)
  })

  it('supports nullable values', () => {
    let schema = nullable(string())
    let result = schema['~standard'].validate(null)

    assertSuccess(result)
    assert.equal(result.value, null)
  })

  it('nullable still validates non-null values', () => {
    let schema = nullable(string())
    let ok = schema['~standard'].validate('hello')
    let bad = schema['~standard'].validate(123)

    assertSuccess(ok)
    assertFailure(bad)
  })

  it('supports refine predicates', () => {
    let schema = number().refine(function isPositive(value) {
      return value > 0
    })

    let ok = schema['~standard'].validate(1)
    let bad = schema['~standard'].validate(-1)

    assertSuccess(ok)
    assertFailure(bad)
  })

  it('refine uses custom message when provided', () => {
    let schema = number().refine((value) => value > 0, 'Must be positive')
    let result = schema['~standard'].validate(-1)

    assertFailure(result)
    assert.equal(result.issues[0].message, 'Must be positive')
  })
})

describe('tuple', () => {
  it('validates tuples and enforces length', () => {
    let schema = tuple([string(), number()])
    let result = schema['~standard'].validate(['ok'])

    assertFailure(result)
  })

  it('returns validated tuple on success', () => {
    let schema = tuple([string(), number(), boolean()])
    let result = schema['~standard'].validate(['hello', 42, true])

    assertSuccess(result)
    assert.deepEqual(result.value, ['hello', 42, true])
  })

  it('rejects non-array values', () => {
    let schema = tuple([string()])
    let result = schema['~standard'].validate('not-array')

    assertFailure(result)
    assert.equal(result.issues[0].message, 'Expected array')
  })

  it('reports length mismatch for extra elements', () => {
    let schema = tuple([string(), number()])
    let result = schema['~standard'].validate(['a', 1, 'extra'])

    assertFailure(result)
    assert.ok(result.issues[0].message.includes('Expected tuple length'))
  })

  it('validates element types with paths', () => {
    let schema = tuple([string(), number()])
    let result = schema['~standard'].validate(['ok', 'not-a-number'])

    assertFailure(result)
    assert.deepEqual(result.issues[0].path, [1])
  })
})

describe('union', () => {
  it('returns the first successful variant', () => {
    let schema = union([string(), number()])
    let result = schema['~standard'].validate(123)

    assertSuccess(result)
    assert.equal(result.value, 123)
  })

  it('fails when no variant matches', () => {
    let schema = union([string(), number()])
    let result = schema['~standard'].validate(false)

    assertFailure(result)
    assert.equal(result.issues.length, 2)
  })

  it('returns first variant issues when abortEarly is enabled', () => {
    let schema = union([string(), number()])
    let result = schema['~standard'].validate(false, { libraryOptions: { abortEarly: true } })

    assertFailure(result)
    assert.equal(result.issues.length, 1)
    assert.equal(result.issues[0].message, 'Expected string')
  })

  it('handles empty schemas array', () => {
    let schema = union([])
    let result = schema['~standard'].validate('anything')

    assertFailure(result)
    assert.equal(result.issues[0].message, 'No union variant matched')
  })
})

describe('record', () => {
  it('validates record values', () => {
    let schema = record(string(), number())
    let result = schema['~standard'].validate({ a: 1, b: 2 })

    assertSuccess(result)
    assert.deepEqual(result.value, { a: 1, b: 2 })
  })

  it('reports invalid record values with paths', () => {
    let schema = record(string(), number())
    let result = schema['~standard'].validate({ a: 'nope' })

    assertFailure(result)
    assert.deepEqual(result.issues[0].path, ['a'])
  })

  it('validates record keys', () => {
    let emailKey = string().refine((s) => s.includes('@'))
    let schema = record(emailKey, number())
    let result = schema['~standard'].validate({ 'not-an-email': 1 })

    assertFailure(result)
    assert.deepEqual(result.issues[0].path, ['not-an-email'])
  })

  it('rejects non-object values', () => {
    let schema = record(string(), number())

    let arrayResult = schema['~standard'].validate([1, 2])
    let nullResult = schema['~standard'].validate(null)
    let primitiveResult = schema['~standard'].validate('string')

    assertFailure(arrayResult)
    assertFailure(nullResult)
    assertFailure(primitiveResult)
    assert.equal(arrayResult.issues[0].message, 'Expected object')
  })

  it('handles empty records', () => {
    let schema = record(string(), number())
    let result = schema['~standard'].validate({})

    assertSuccess(result)
    assert.deepEqual(result.value, {})
  })
})

describe('map', () => {
  it('validates map entries', () => {
    let schema = map(string(), number())
    let result = schema['~standard'].validate(
      new Map([
        ['a', 1],
        ['b', 2],
      ]),
    )

    assertSuccess(result)
    assert.ok(result.value instanceof Map)
    assert.equal(result.value.get('a'), 1)
    assert.equal(result.value.get('b'), 2)
  })

  it('reports invalid map values with paths', () => {
    let schema = map(string(), number())
    let result = schema['~standard'].validate(new Map([['a', 'nope']]))

    assertFailure(result)
    assert.deepEqual(result.issues[0].path, ['a'])
  })

  it('validates map keys', () => {
    let emailKey = string().refine((s) => s.includes('@'))
    let schema = map(emailKey, number())
    let result = schema['~standard'].validate(new Map([['not-an-email', 1]]))

    assertFailure(result)
    assert.deepEqual(result.issues[0].path, ['not-an-email'])
  })

  it('rejects non-Map values', () => {
    let schema = map(string(), number())

    let objectResult = schema['~standard'].validate({ a: 1 })
    let arrayResult = schema['~standard'].validate([1, 2])
    let nullResult = schema['~standard'].validate(null)

    assertFailure(objectResult)
    assertFailure(arrayResult)
    assertFailure(nullResult)
    assert.equal(objectResult.issues[0].message, 'Expected Map')
  })

  it('handles empty maps', () => {
    let schema = map(string(), number())
    let result = schema['~standard'].validate(new Map())

    assertSuccess(result)
    assert.ok(result.value instanceof Map)
    assert.equal(result.value.size, 0)
  })

  it('supports non-string keys', () => {
    let schema = map(number(), string())
    let result = schema['~standard'].validate(
      new Map([
        [1, 'one'],
        [2, 'two'],
      ]),
    )

    assertSuccess(result)
    assert.equal(result.value.get(1), 'one')
    assert.equal(result.value.get(2), 'two')
  })
})

describe('set', () => {
  it('validates set values', () => {
    let schema = set(number())
    let result = schema['~standard'].validate(new Set([1, 2, 3]))

    assertSuccess(result)
    assert.ok(result.value instanceof Set)
    assert.equal(result.value.size, 3)
    assert.ok(result.value.has(1))
    assert.ok(result.value.has(2))
    assert.ok(result.value.has(3))
  })

  it('reports invalid set values with paths', () => {
    let schema = set(number())
    let result = schema['~standard'].validate(new Set([1, 'nope', 3]))

    assertFailure(result)
    assert.deepEqual(result.issues[0].path, [1])
  })

  it('rejects non-Set values', () => {
    let schema = set(number())

    let arrayResult = schema['~standard'].validate([1, 2, 3])
    let objectResult = schema['~standard'].validate({ a: 1 })
    let nullResult = schema['~standard'].validate(null)

    assertFailure(arrayResult)
    assertFailure(objectResult)
    assertFailure(nullResult)
    assert.equal(arrayResult.issues[0].message, 'Expected Set')
  })

  it('handles empty sets', () => {
    let schema = set(string())
    let result = schema['~standard'].validate(new Set())

    assertSuccess(result)
    assert.ok(result.value instanceof Set)
    assert.equal(result.value.size, 0)
  })

  it('validates complex values', () => {
    let schema = set(object({ id: number() }))
    let result = schema['~standard'].validate(new Set([{ id: 1 }, { id: 2 }]))

    assertSuccess(result)
    assert.equal(result.value.size, 2)
  })

  it('collects all issues by default', () => {
    let schema = set(number())
    let result = schema['~standard'].validate(new Set(['a', 'b', 'c']))

    assertFailure(result)
    assert.equal(result.issues.length, 3)
  })
})

describe('any', () => {
  it('accepts any value', () => {
    let schema = any()

    assertSuccess(schema['~standard'].validate('hello'))
    assertSuccess(schema['~standard'].validate(42))
    assertSuccess(schema['~standard'].validate(null))
    assertSuccess(schema['~standard'].validate(undefined))
    assertSuccess(schema['~standard'].validate({ a: 1 }))
    assertSuccess(schema['~standard'].validate([1, 2]))
  })

  it('preserves the original value', () => {
    let schema = any()
    let obj = { nested: true }
    let result = schema['~standard'].validate(obj)

    assertSuccess(result)
    assert.equal(result.value, obj)
  })
})

describe('enum_', () => {
  it('accepts allowed values', () => {
    let schema = enum_(['active', 'inactive', 'pending'] as const)

    assertSuccess(schema['~standard'].validate('active'))
    assertSuccess(schema['~standard'].validate('inactive'))
    assertSuccess(schema['~standard'].validate('pending'))
  })

  it('rejects values not in the list', () => {
    let schema = enum_(['active', 'inactive'] as const)
    let result = schema['~standard'].validate('deleted')

    assertFailure(result)
    assert.ok(result.issues[0].message.includes('active'))
    assert.ok(result.issues[0].message.includes('inactive'))
  })

  it('works with numeric values', () => {
    let schema = enum_([0, 1, 2] as const)

    assertSuccess(schema['~standard'].validate(1))
    assertFailure(schema['~standard'].validate(3))
  })

  it('uses strict equality', () => {
    let schema = enum_([1, 2, 3] as const)

    assertFailure(schema['~standard'].validate('1'))
  })
})

describe('instanceof_', () => {
  it('accepts instances of the class', () => {
    let schema = instanceof_(Date)
    let date = new Date()
    let result = schema['~standard'].validate(date)

    assertSuccess(result)
    assert.equal(result.value, date)
  })

  it('rejects non-instances', () => {
    let schema = instanceof_(Date)
    let result = schema['~standard'].validate('2025-01-01')

    assertFailure(result)
    assert.ok(result.issues[0].message.includes('Date'))
  })

  it('works with custom classes', () => {
    class MyClass {
      value = 42
    }

    let schema = instanceof_(MyClass)

    assertSuccess(schema['~standard'].validate(new MyClass()))
    assertFailure(schema['~standard'].validate({ value: 42 }))
  })

  it('works with subclasses', () => {
    class Base {}
    class Child extends Base {}

    let schema = instanceof_(Base)

    assertSuccess(schema['~standard'].validate(new Child()))
  })

  it('provides path in nested contexts', () => {
    let schema = object({ created: instanceof_(Date) })
    let result = schema['~standard'].validate({ created: 'not-a-date' })

    assertFailure(result)
    assert.deepEqual(result.issues[0].path, ['created'])
  })
})

describe('modifiers (additional)', () => {
  it('refine propagates path inside objects', () => {
    let schema = object({ age: number().refine((v) => v > 0, 'Must be positive') })
    let result = schema['~standard'].validate({ age: -1 })

    assertFailure(result)
    assert.equal(result.issues[0].message, 'Must be positive')
    assert.deepEqual(result.issues[0].path, ['age'])
  })

  it('defaulted fills missing keys in objects', () => {
    let schema = object({ name: string(), role: defaulted(string(), 'user') })
    let result = schema['~standard'].validate({ name: 'Ada' })

    assertSuccess(result)
    assert.deepEqual(result.value, { name: 'Ada', role: 'user' })
  })

  it('defaulted fills explicit undefined in objects', () => {
    let schema = object({ role: defaulted(string(), 'user') })
    let result = schema['~standard'].validate({ role: undefined })

    assertSuccess(result)
    assert.deepEqual(result.value, { role: 'user' })
  })

  it('chains pipe then refine', () => {
    let schema = string()
      .pipe(minLength(3))
      .refine((s) => s.startsWith('a'), 'Must start with a')

    assertSuccess(schema['~standard'].validate('abc'))
    assertFailure(schema['~standard'].validate('ab'))
    assertFailure(schema['~standard'].validate('bcd'))
  })

  it('chains refine then pipe', () => {
    let schema = string()
      .refine((s) => s.startsWith('a'), 'Must start with a')
      .pipe(minLength(3))

    assertSuccess(schema['~standard'].validate('abc'))
    assertFailure(schema['~standard'].validate('bcd'))
    assertFailure(schema['~standard'].validate('ab'))
  })
})

describe('abortEarly', () => {
  it('collects all issues by default', () => {
    let schema = object({ name: string(), age: number() })
    let result = schema['~standard'].validate({ name: 123, age: 'x' })

    assertFailure(result)
    assert.equal(result.issues.length, 2)
  })

  it('returns the first issue when enabled', () => {
    let schema = object({ name: string(), age: number() })
    let result = schema['~standard'].validate(
      { name: 123, age: 'x' },
      { libraryOptions: { abortEarly: true } },
    )

    assertFailure(result)
    assert.equal(result.issues.length, 1)
  })
})
