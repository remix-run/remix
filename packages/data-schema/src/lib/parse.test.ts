import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { minLength } from './checks.ts'
import { number, object, parse, parseSafe, string } from './schema.ts'

describe('parse', () => {
  it('returns validated output', () => {
    let schema = object({ name: string(), age: number() })
    let result = parse(schema, { name: 'Ada', age: 37 })

    assert.deepEqual(result, { name: 'Ada', age: 37 })
  })

  it('throws ValidationError with issues', () => {
    let schema = object({ name: string(), age: number() })

    assert.throws(
      function () {
        parse(schema, { name: 123, age: 'x' })
      },
      function (error: unknown) {
        return (
          error instanceof Error &&
          error.name === 'ValidationError' &&
          'issues' in error &&
          Array.isArray((error as { issues: unknown }).issues)
        )
      },
    )
  })
})

describe('parseSafe', () => {
  it('returns success with value', () => {
    let schema = object({ name: string(), age: number() })
    let result = parseSafe(schema, { name: 'Ada', age: 37 })

    assert.ok(result.success)
    assert.deepEqual(result.value, { name: 'Ada', age: 37 })
  })

  it('returns issues on failure', () => {
    let schema = object({ name: string(), age: number() })
    let result = parseSafe(schema, { name: 123, age: 'x' })

    assert.ok(!result.success)
    assert.equal(result.issues.length, 2)
  })

  it('supports abortEarly option', () => {
    let schema = object({ name: string(), age: number() })
    let result = parseSafe(schema, { name: 123, age: 'x' }, { abortEarly: true })

    assert.ok(!result.success)
    assert.equal(result.issues.length, 1)
  })

  it('supports errorMap for custom issue messages', () => {
    let schema = object({ name: string(), age: number() })
    let result = parseSafe(
      schema,
      { name: 123, age: 'x' },
      {
        errorMap(context) {
          if (context.code === 'type.string') {
            return 'Expected text input'
          }

          return undefined
        },
      },
    )

    assert.ok(!result.success)
    assert.equal(result.issues[0].message, 'Expected text input')
    assert.equal(result.issues[1].message, 'Expected number')
  })

  it('passes locale and values to errorMap', () => {
    let schema = string().pipe(minLength(3))
    let captured: { code: string; locale: string | undefined; values: unknown } | undefined

    let result = parseSafe(schema, 'ab', {
      locale: 'es',
      errorMap(context) {
        captured = {
          code: context.code,
          locale: context.locale,
          values: context.values,
        }

        if (context.code === 'string.min_length') {
          return (
            'Debe tener al menos ' + String((context.values as { min: number }).min) + ' caracteres'
          )
        }
      },
    })

    assert.ok(!result.success)
    assert.equal(result.issues[0].message, 'Debe tener al menos 3 caracteres')
    assert.deepEqual(captured, {
      code: 'string.min_length',
      locale: 'es',
      values: { min: 3 },
    })
  })

  it('falls back to default message when errorMap returns undefined', () => {
    let schema = number()
    let result = parseSafe(schema, 'x', {
      errorMap() {
        return undefined
      },
    })

    assert.ok(!result.success)
    assert.equal(result.issues[0].message, 'Expected number')
  })
})
