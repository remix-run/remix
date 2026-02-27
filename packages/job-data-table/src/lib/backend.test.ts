import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getJobSchemaSql } from './backend.ts'

describe('getJobSchemaSql', () => {
  it('returns statements for supported dialects', () => {
    let statements = getJobSchemaSql('sqlite', 'custom_')

    assert.ok(statements.length > 0)
    assert.ok(statements[0].includes('custom_jobs'))
  })

  it('throws for unsupported dialects', () => {
    assert.throws(() => {
      getJobSchemaSql('mssql' as never)
    }, /Unsupported dialect/)
  })
})
