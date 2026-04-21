import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isSqlStatement, rawSql, sql } from './sql.ts'

describe('sql statements', () => {
  it('builds placeholder statements from scalar values', () => {
    let statement = sql`select * from accounts where id = ${1} and email = ${'a@example.com'}`

    assert.deepEqual(statement, {
      text: 'select * from accounts where id = ? and email = ?',
      values: [1, 'a@example.com'],
    })
  })

  it('inlines nested sql statements and merges values', () => {
    let condition = sql`status = ${'active'}`
    let statement = sql`select * from accounts where ${condition} and id > ${10}`

    assert.deepEqual(statement, {
      text: 'select * from accounts where status = ? and id > ?',
      values: ['active', 10],
    })
  })

  it('checks sql statement shapes', () => {
    assert.equal(isSqlStatement({ text: 'select 1', values: [] }), true)
    assert.equal(isSqlStatement({ text: 123, values: [] }), false)
    assert.equal(isSqlStatement({ text: 'select 1', values: 'oops' }), false)
    assert.equal(isSqlStatement(null), false)
  })

  it('creates raw sql statements', () => {
    assert.deepEqual(rawSql('select 1'), {
      text: 'select 1',
      values: [],
    })
    assert.deepEqual(rawSql('select * from accounts where id = ?', [5]), {
      text: 'select * from accounts where id = ?',
      values: [5],
    })
  })
})
