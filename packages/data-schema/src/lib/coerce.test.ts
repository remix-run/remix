import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { coerceBigint, coerceBoolean, coerceDate, coerceNumber, coerceString } from './coerce.ts'
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

describe('coerce', () => {
  it('coerces numbers from strings', () => {
    let schema = coerceNumber()

    let ok = schema['~standard'].validate('42')
    let okTrimmed = schema['~standard'].validate(' 3.5 ')
    let bad = schema['~standard'].validate('nope')

    assertSuccess(ok)
    assertSuccess(okTrimmed)
    assert.equal(ok.value, 42)
    assert.equal(okTrimmed.value, 3.5)
    assertFailure(bad)
  })

  it('coerces numbers and passes through valid numbers', () => {
    let schema = coerceNumber()
    let result = schema['~standard'].validate(3.14)

    assertSuccess(result)
    assert.equal(result.value, 3.14)
  })

  it('rejects Infinity and NaN for coerced numbers', () => {
    let schema = coerceNumber()

    let posInf = schema['~standard'].validate(Infinity)
    let negInf = schema['~standard'].validate(-Infinity)
    let nan = schema['~standard'].validate(NaN)
    let infString = schema['~standard'].validate('Infinity')
    let negInfString = schema['~standard'].validate('-Infinity')

    assertFailure(posInf)
    assertFailure(negInf)
    assertFailure(nan)
    assertFailure(infString)
    assertFailure(negInfString)
  })

  it('rejects empty strings for coerced numbers', () => {
    let schema = coerceNumber()
    let result = schema['~standard'].validate('   ')

    assertFailure(result)
  })

  it('coerces booleans from strings', () => {
    let schema = coerceBoolean()

    let okTrue = schema['~standard'].validate('true')
    let okFalse = schema['~standard'].validate('FALSE')
    let bad = schema['~standard'].validate('yes')

    assertSuccess(okTrue)
    assertSuccess(okFalse)
    assert.equal(okTrue.value, true)
    assert.equal(okFalse.value, false)
    assertFailure(bad)
  })

  it('passes through boolean values', () => {
    let schema = coerceBoolean()

    let okTrue = schema['~standard'].validate(true)
    let okFalse = schema['~standard'].validate(false)

    assertSuccess(okTrue)
    assertSuccess(okFalse)
    assert.equal(okTrue.value, true)
    assert.equal(okFalse.value, false)
  })

  it('trims whitespace for boolean strings', () => {
    let schema = coerceBoolean()
    let result = schema['~standard'].validate('  TRUE  ')

    assertSuccess(result)
    assert.equal(result.value, true)
  })

  it('rejects non-boolean non-string values for coerceBoolean', () => {
    let schema = coerceBoolean()

    let numResult = schema['~standard'].validate(1)
    let objResult = schema['~standard'].validate({})

    assertFailure(numResult)
    assertFailure(objResult)
  })

  it('coerces dates from strings', () => {
    let schema = coerceDate()

    let ok = schema['~standard'].validate('2025-01-01T00:00:00Z')
    let bad = schema['~standard'].validate('not-a-date')

    assertSuccess(ok)
    assert.ok(ok.value instanceof Date)
    assertFailure(bad)
  })

  it('passes through valid Date instances', () => {
    let schema = coerceDate()
    let input = new Date('2025-06-15')
    let result = schema['~standard'].validate(input)

    assertSuccess(result)
    assert.equal(result.value, input)
  })

  it('rejects invalid Date instances', () => {
    let schema = coerceDate()
    let invalidDate = new Date('invalid')
    let result = schema['~standard'].validate(invalidDate)

    assertFailure(result)
  })

  it('rejects non-string non-date values for coerceDate', () => {
    let schema = coerceDate()

    let numResult = schema['~standard'].validate(1234567890)
    let objResult = schema['~standard'].validate({})

    assertFailure(numResult)
    assertFailure(objResult)
  })

  it('coerces bigint from strings and integers', () => {
    let schema = coerceBigint()

    let okString = schema['~standard'].validate('9007199254740993')
    let okNumber = schema['~standard'].validate(10)
    let bad = schema['~standard'].validate(1.5)

    assertSuccess(okString)
    assertSuccess(okNumber)
    assert.equal(okString.value, BigInt('9007199254740993'))
    assert.equal(okNumber.value, BigInt(10))
    assertFailure(bad)
  })

  it('passes through bigint values', () => {
    let schema = coerceBigint()
    let result = schema['~standard'].validate(BigInt(999))

    assertSuccess(result)
    assert.equal(result.value, BigInt(999))
  })

  it('rejects empty strings for coerceBigint', () => {
    let schema = coerceBigint()
    let result = schema['~standard'].validate('   ')

    assertFailure(result)
  })

  it('rejects invalid bigint strings', () => {
    let schema = coerceBigint()
    let result = schema['~standard'].validate('12.5')

    assertFailure(result)
  })

  it('rejects Infinity and NaN for coerceBigint', () => {
    let schema = coerceBigint()

    let infResult = schema['~standard'].validate(Infinity)
    let nanResult = schema['~standard'].validate(NaN)

    assertFailure(infResult)
    assertFailure(nanResult)
  })

  it('coerces strings from primitives', () => {
    let schema = coerceString()

    let okNumber = schema['~standard'].validate(5)
    let okBoolean = schema['~standard'].validate(false)
    let okBigint = schema['~standard'].validate(BigInt(7))
    let bad = schema['~standard'].validate({})

    assertSuccess(okNumber)
    assertSuccess(okBoolean)
    assertSuccess(okBigint)
    assert.equal(okNumber.value, '5')
    assert.equal(okBoolean.value, 'false')
    assert.equal(okBigint.value, '7')
    assertFailure(bad)
  })

  it('passes through string values', () => {
    let schema = coerceString()
    let result = schema['~standard'].validate('hello')

    assertSuccess(result)
    assert.equal(result.value, 'hello')
  })

  it('coerces symbols to strings', () => {
    let schema = coerceString()
    let mySymbol = Symbol('test')
    let result = schema['~standard'].validate(mySymbol)

    assertSuccess(result)
    assert.equal(result.value, 'Symbol(test)')
  })

  it('rejects null and undefined for coerceString', () => {
    let schema = coerceString()

    let nullResult = schema['~standard'].validate(null)
    let undefinedResult = schema['~standard'].validate(undefined)

    assertFailure(nullResult)
    assertFailure(undefinedResult)
  })

  it('rejects arrays and objects for coerceString', () => {
    let schema = coerceString()

    let arrayResult = schema['~standard'].validate([1, 2])
    let objectResult = schema['~standard'].validate({ a: 1 })

    assertFailure(arrayResult)
    assertFailure(objectResult)
  })
})
