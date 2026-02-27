import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getJobSchemaSql } from './backend.ts'

describe('getJobSchemaSql', () => {
  it('returns statements for supported dialects', () => {
    let statements = getJobSchemaSql('sqlite', 'custom_')

    assert.ok(statements.length > 0)
    assert.ok(statements[0].includes('custom_jobs'))
  })

  it('uses mysql-safe key and indexed column types', () => {
    let statements = getJobSchemaSql('mysql', 'custom_')

    assert.ok(statements[0].includes('id varchar(191) primary key'))
    assert.ok(statements[0].includes('queue varchar(191) not null'))
    assert.ok(statements[0].includes('status varchar(32) not null'))
    assert.ok(statements[1].includes('dedupe_key varchar(191) primary key'))
    assert.ok(statements[2].includes('id varchar(191) primary key'))
  })

  it('throws for unsupported dialects', () => {
    assert.throws(() => {
      getJobSchemaSql('mssql' as never)
    }, /Unsupported dialect/)
  })
})
