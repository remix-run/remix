import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { quoteLiteral } from './sql-helpers.ts'

describe('quoteLiteral', () => {
  it('renders null as NULL', () => {
    assert.equal(quoteLiteral(null), 'null')
  })

  it('renders numbers and bigints as bare literals', () => {
    assert.equal(quoteLiteral(42), '42')
    assert.equal(quoteLiteral(-3.14), '-3.14')
    assert.equal(quoteLiteral(9007199254740991n), '9007199254740991')
  })

  it('renders booleans as true/false by default', () => {
    assert.equal(quoteLiteral(true), 'true')
    assert.equal(quoteLiteral(false), 'false')
  })

  it('renders booleans as 1/0 when booleansAsIntegers is set', () => {
    assert.equal(quoteLiteral(true, { booleansAsIntegers: true }), '1')
    assert.equal(quoteLiteral(false, { booleansAsIntegers: true }), '0')
  })

  it('wraps strings in single quotes', () => {
    assert.equal(quoteLiteral('hello'), "'hello'")
  })

  it('doubles single quotes inside strings', () => {
    assert.equal(quoteLiteral("O'Brien"), "'O''Brien'")
  })

  it('does not escape backslashes by default (correct for PostgreSQL and SQLite)', () => {
    assert.equal(quoteLiteral('a\\b'), "'a\\b'")
  })

  it('doubles backslashes when backslashEscapes is true (MySQL safety)', () => {
    assert.equal(quoteLiteral('a\\b', { backslashEscapes: true }), "'a\\\\b'")
  })

  it('escapes backslashes before doubling single quotes when backslashEscapes is true', () => {
    // Input: backslash + single-quote  (\')
    // Without backslashEscapes MySQL would parse \' as an escaped quote,
    // allowing the attacker to break out of the string literal.
    // With backslashEscapes: backslash → \\, then quote → '' → safe.
    // Result: '\\'' — MySQL reads \\ as one backslash, '' as one single-quote.
    assert.equal(quoteLiteral("\\'", { backslashEscapes: true }), "'\\\\'''")
  })

  it('quotes Date values as ISO strings', () => {
    let d = new Date('2026-01-01T00:00:00.000Z')
    assert.equal(quoteLiteral(d), "'2026-01-01T00:00:00.000Z'")
  })
})
