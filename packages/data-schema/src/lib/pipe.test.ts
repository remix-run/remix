import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { minLength, maxLength } from './checks.ts'
import { string } from './schema.ts'
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

describe('pipe', () => {
  it('applies checks in order', () => {
    let schema = string().pipe(minLength(2), maxLength(4))

    let ok = schema['~standard'].validate('test')
    let short = schema['~standard'].validate('a')
    let long = schema['~standard'].validate('toolong')

    assertSuccess(ok)
    assertFailure(short)
    assertFailure(long)
  })
})
