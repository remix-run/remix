import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isSqlStatement, rawSql, sql } from './sql.ts'

describe('sql statements', () => {
  it('builds placeholder statements from scalar values', () => {
    let statement = sql`select * from accounts where id = ${1} and email = ${'a@example.com'}`

    assert.equal(statement.text, 'select * from accounts where id = ? and email = ?')
    assert.deepEqual(statement.values, [1, 'a@example.com'])
  })

  it('inlines nested sql statements and merges values', () => {
    let condition = sql`status = ${'active'}`
    let statement = sql`select * from accounts where ${condition} and id > ${10}`

    assert.equal(statement.text, 'select * from accounts where status = ? and id > ?')
    assert.deepEqual(statement.values, ['active', 10])
  })

  it('checks sql statement shapes', () => {
    // Only branded values produced by sql`` or rawSql() pass the check.
    assert.equal(isSqlStatement(sql`select 1`), true)
    assert.equal(isSqlStatement(rawSql('select 1')), true)

    // Plain objects with matching shape are intentionally rejected to prevent
    // user-controlled data from being interpolated as raw SQL.
    assert.equal(isSqlStatement({ text: 'select 1', values: [] }), false)
    assert.equal(isSqlStatement({ text: 123, values: [] }), false)
    assert.equal(isSqlStatement({ text: 'select 1', values: 'oops' }), false)
    assert.equal(isSqlStatement(null), false)
  })

  it('plain objects are not treated as SQL fragments inside sql`` templates', () => {
    // An attacker-supplied object with { text, values } must be parameterized,
    // not inlined as raw SQL.
    let userInput = { text: "' OR '1'='1", values: [] }
    let statement = sql`select * from users where name = ${userInput}`

    assert.equal(statement.text, 'select * from users where name = ?')
    assert.deepEqual(statement.values, [userInput])
  })

  it('creates raw sql statements', () => {
    let s1 = rawSql('select 1')
    assert.equal(s1.text, 'select 1')
    assert.deepEqual(s1.values, [])

    let s2 = rawSql('select * from accounts where id = ?', [5])
    assert.equal(s2.text, 'select * from accounts where id = ?')
    assert.deepEqual(s2.values, [5])
  })
})
