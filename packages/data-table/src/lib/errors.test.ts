import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  DataTableAdapterError,
  DataTableConstraintError,
  DataTableError,
  DataTableQueryError,
  DataTableValidationError,
} from './errors.ts'

describe('data-table errors', () => {
  it('constructs base errors with defaults and options', () => {
    let base = new DataTableError('boom')
    assert.equal(base.name, 'DataTableError')
    assert.equal(base.code, 'DATA_TABLE_ERROR')
    assert.equal(base.metadata, undefined)

    let cause = new Error('cause')
    let withOptions = new DataTableError('oops', {
      code: 'CUSTOM',
      cause,
      metadata: { scope: 'test' },
    })

    assert.equal(withOptions.code, 'CUSTOM')
    assert.equal(withOptions.cause, cause)
    assert.deepEqual(withOptions.metadata, { scope: 'test' })
  })

  it('constructs validation errors', () => {
    let cause = new Error('invalid')
    let error = new DataTableValidationError('invalid row', ['missing id'], {
      cause,
      metadata: { table: 'accounts' },
    })

    assert.equal(error.name, 'DataTableValidationError')
    assert.equal(error.code, 'DATA_TABLE_VALIDATION_ERROR')
    assert.equal(error.cause, cause)
    assert.deepEqual(error.issues, ['missing id'])
    assert.deepEqual(error.metadata, { table: 'accounts' })
  })

  it('constructs query, adapter, and constraint errors', () => {
    let queryError = new DataTableQueryError('bad query')
    assert.equal(queryError.name, 'DataTableQueryError')
    assert.equal(queryError.code, 'DATA_TABLE_QUERY_ERROR')

    let adapterError = new DataTableAdapterError('adapter failed', {
      metadata: { adapter: 'postgres' },
    })
    assert.equal(adapterError.name, 'DataTableAdapterError')
    assert.equal(adapterError.code, 'DATA_TABLE_ADAPTER_ERROR')
    assert.deepEqual(adapterError.metadata, { adapter: 'postgres' })

    let constraintError = new DataTableConstraintError('duplicate key', {
      metadata: { constraint: 'accounts_pkey' },
    })
    assert.equal(constraintError.name, 'DataTableConstraintError')
    assert.equal(constraintError.code, 'DATA_TABLE_CONSTRAINT_ERROR')
    assert.deepEqual(constraintError.metadata, { constraint: 'accounts_pkey' })
  })
})
