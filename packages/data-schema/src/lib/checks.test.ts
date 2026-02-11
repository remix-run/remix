import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { email, max, maxLength, min, minLength, url } from './checks.ts'
import { number, string } from './schema.ts'
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
