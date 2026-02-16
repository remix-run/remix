import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { literal, number, object, string, variant } from './schema.ts'
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

describe('variant', () => {
  it('validates based on discriminator', () => {
    let schema = variant('type', {
      created: object({ type: literal('created'), id: string() }),
      updated: object({ type: literal('updated'), id: string(), version: number() }),
    })

    let created = schema['~standard'].validate({ type: 'created', id: 'a' })
    let updated = schema['~standard'].validate({ type: 'updated', id: 'b', version: 2 })

    assertSuccess(created)
    assertSuccess(updated)
  })

  it('reports unknown discriminator values', () => {
    let schema = variant('type', {
      created: object({ type: literal('created'), id: string() }),
    })

    let result = schema['~standard'].validate({ type: 'other', id: 'a' })

    assertFailure(result)
    assert.deepEqual(result.issues[0].path, ['type'])
  })

  it('reports missing discriminator', () => {
    let schema = variant('type', {
      created: object({ type: literal('created'), id: string() }),
    })

    let result = schema['~standard'].validate({ id: 'a' })

    assertFailure(result)
    assert.deepEqual(result.issues[0].path, ['type'])
  })
})
