import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

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
})
