import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { column } from './column.ts'
import { isColumnReference, normalizeColumnInput } from './references.ts'
import { table } from './table.ts'

let accounts = table({
  name: 'accounts',
  columns: {
    id: column.integer(),
  },
})

describe('column references', () => {
  it('identifies valid and invalid column references', () => {
    assert.equal(isColumnReference(accounts.id), true)
    assert.equal(isColumnReference({ kind: 'column' }), false)
    assert.equal(isColumnReference({ kind: 'not-column' }), false)
    assert.equal(isColumnReference('accounts.id'), false)
    assert.equal(isColumnReference(null), false)
  })

  it('normalizes string and column-reference inputs', () => {
    assert.equal(normalizeColumnInput('accounts.id'), 'accounts.id')
    assert.equal(normalizeColumnInput(accounts.id), 'accounts.id')
  })
})
