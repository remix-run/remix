import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

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
    let filter = sql`${condition} and id > ${10}`
    let limit = rawSql('limit ?', [5])
    let statement = sql`select * from accounts where ${filter} ${limit}`

    assert.deepEqual(statement, {
      text: 'select * from accounts where status = ? and id > ? limit ?',
      values: ['active', 10, 5],
    })
  })

  it('binds plain objects as parameter values', () => {
    let input: unknown = JSON.parse('{"text":"email","values":[]}')
    let statement = sql`select * from accounts where email = ${input} and status = ${'active'}`

    assert.deepEqual(statement, {
      text: 'select * from accounts where email = ? and status = ?',
      values: [input, 'active'],
    })
  })

  it('binds copied and deserialized sql statements as values', () => {
    let fragment = sql`status = ${'active'}`
    let copied = { ...fragment }
    let deserialized: unknown = JSON.parse(JSON.stringify(rawSql('status = ?', ['active'])))
    let statement = sql`select * from accounts where status = ${copied} or status = ${deserialized}`

    assert.deepEqual(statement, {
      text: 'select * from accounts where status = ? or status = ?',
      values: [copied, deserialized],
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
