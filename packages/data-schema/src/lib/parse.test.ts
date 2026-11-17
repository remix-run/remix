import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { minLength } from './checks.ts'
import { number, object, parse, parseSafe, string } from './schema.ts'
import type { ErrorMapContext } from './schema.ts'

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

  it('preserves paths in retained error map contexts', () => {
    let captured: ErrorMapContext[] = []
    let schema = object({
      user: object({
        name: string(),
        nickname: string().pipe(minLength(3)),
        age: number().refine((value) => value >= 0),
      }),
    })

    let result = parseSafe(
      schema,
      { user: { name: 123, nickname: 'a', age: -1 } },
      {
        errorMap(context) {
          captured.push(context)
        },
      },
    )

    assert.ok(!result.success)
    assert.deepEqual(
      captured.map((context) => context.path),
      [
        ['user', 'name'],
        ['user', 'nickname'],
        ['user', 'age'],
      ],
    )
    assert.deepEqual(
      result.issues.map((issue) => issue.path),
      [
        ['user', 'name'],
        ['user', 'nickname'],
        ['user', 'age'],
      ],
    )
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

  it('preserves explicit refinement messages without calling errorMap', () => {
    let schema = string().refine(() => false, 'Original message')
    let result = parseSafe(schema, 'value', {
      errorMap() {
        throw new Error('Explicit refinement messages must bypass errorMap')
      },
    })
    assert.ok(!result.success)
    assert.equal(result.issues[0].message, 'Original message')
  })

  it('preserves an explicitly empty refinement message', () => {
    let schema = string().refine(() => false, '')
    let result = parseSafe(schema, 'value', {
      errorMap: () => 'Mapped message',
    })
    assert.ok(!result.success)
    assert.equal(result.issues[0].message, '')
  })

  it('maps refinements without explicit messages and falls back when the map declines', () => {
    let schema = string().refine(() => false)
    let result = parseSafe(schema, 'value', {
      errorMap({ code, defaultMessage }) {
        assert.equal(code, 'refine.failed')
        assert.equal(defaultMessage, 'Refinement failed')
        return 'Mapped message'
      },
    })
    assert.ok(!result.success)
    assert.equal(result.issues[0].message, 'Mapped message')
    let fallback = parseSafe(schema, 'value', { errorMap: () => undefined })
    assert.ok(!fallback.success)
    assert.equal(fallback.issues[0].message, 'Refinement failed')
  })

  it('preserves uncoded check messages without calling errorMap', () => {
    let schema = string().pipe({ check: () => false, message: 'Original check' })
    let result = parseSafe(schema, 'value', {
      errorMap() {
        throw new Error('Uncoded checks must bypass errorMap')
      },
    })
    assert.ok(!result.success)
    assert.equal(result.issues[0].message, 'Original check')
  })

  it('preserves the default message of uncoded checks', () => {
    let schema = string().pipe({ check: () => false })
    let result = parseSafe(schema, 'value', {
      errorMap: () => 'Mapped check',
    })
    assert.ok(!result.success)
    assert.equal(result.issues[0].message, 'Check failed')
  })

  it('continues mapping coded checks with explicit messages', () => {
    let schema = string().pipe({
      check: () => false,
      code: 'username.reserved',
      message: 'Original check',
    })
    let result = parseSafe(schema, 'value', {
      errorMap({ code, defaultMessage }) {
        assert.equal(code, 'username.reserved')
        assert.equal(defaultMessage, 'Original check')
        return 'Mapped check'
      },
    })
    assert.ok(!result.success)
    assert.equal(result.issues[0].message, 'Mapped check')
  })
})
