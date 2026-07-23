import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { email, max, maxLength, min, minLength, url } from './checks.ts'
import { boolean, getConstraints, literal, number, optional, string } from '../index.ts'
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

describe('checks', () => {
  it('exposes code and values for message mapping', () => {
    let minLengthCheck = minLength(2)
    let maxLengthCheck = maxLength(4)

    assert.equal(minLengthCheck.code, 'string.min_length')
    assert.deepEqual(minLengthCheck.values, { min: 2 })
    assert.equal(maxLengthCheck.code, 'string.max_length')
    assert.deepEqual(maxLengthCheck.values, { max: 4 })
  })

  it('supports common string checks', () => {
    let schema = string().pipe(minLength(2), maxLength(4))

    let ok = schema['~standard'].validate('test')
    let short = schema['~standard'].validate('a')
    let long = schema['~standard'].validate('toolong')

    assertSuccess(ok)
    assertFailure(short)
    assertFailure(long)
  })

  it('supports email checks', () => {
    let schema = string().pipe(email())

    let ok = schema['~standard'].validate('user@example.com')
    let bad = schema['~standard'].validate('not-an-email')

    assertSuccess(ok)
    assertFailure(bad)
  })

  it('supports url checks', () => {
    let schema = string().pipe(url())

    let ok = schema['~standard'].validate('https://example.com')
    let bad = schema['~standard'].validate('not-a-url')

    assertSuccess(ok)
    assertFailure(bad)
  })

  it('supports number checks', () => {
    let schema = number().pipe(min(3), max(5))

    let ok = schema['~standard'].validate(4)
    let low = schema['~standard'].validate(2)
    let high = schema['~standard'].validate(6)

    assertSuccess(ok)
    assertFailure(low)
    assertFailure(high)
  })
})

describe('getConstraints', () => {
  it('returns native length and range constraints', () => {
    assert.deepEqual(getConstraints(string().pipe(minLength(2), maxLength(50)), { type: 'text' }), {
      required: true,
      minLength: 2,
      maxLength: 50,
    })
    assert.deepEqual(getConstraints(number().pipe(min(13), max(120)), { type: 'number' }), {
      required: true,
      step: 'any',
      min: 13,
      max: 120,
    })
  })

  it('derives requiredness from the input type', () => {
    assert.deepEqual(getConstraints(string(), { type: 'text' }), {
      required: true,
    })
    assert.deepEqual(getConstraints(optional(string()), { type: 'text' }), {})
    assert.deepEqual(getConstraints(boolean(), { type: 'checkbox' }), {})
    assert.deepEqual(getConstraints(literal(true), { type: 'checkbox' }), {
      required: true,
    })
  })

  it('preserves constraints through schema composition', () => {
    let schema = optional(string().pipe(minLength(2), maxLength(50)))
      .refine((value) => value !== 'admin')
      .transform((value) => value?.trim())

    assert.deepEqual(getConstraints(schema, { type: 'text' }), {
      minLength: 2,
      maxLength: 50,
    })
  })

  it('omits checks that do not map to native constraints', () => {
    assert.deepEqual(getConstraints(optional(string().pipe(email(), url())), { type: 'url' }), {})
  })
})
