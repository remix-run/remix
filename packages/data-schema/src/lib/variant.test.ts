import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { literal, number, object, string, variant } from './schema.ts'
import type { InferOutput, Issue, ValidationResult } from './schema.ts'

type Equal<left, right> =
  (<value>() => value extends left ? 1 : 2) extends <value>() => value extends right ? 1 : 2
    ? true
    : false

function expectType<condition extends true>(_value?: condition): void {}

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
  it('infers literal discriminator values', () => {
    let schema = variant('type', {
      created: object({ type: literal('created'), id: string() }),
      updated: object({ type: literal('updated'), id: string(), version: number() }),
    })

    expectType<
      Equal<
        InferOutput<typeof schema>,
        { type: 'created'; id: string } | { type: 'updated'; id: string; version: number }
      >
    >()
  })

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
