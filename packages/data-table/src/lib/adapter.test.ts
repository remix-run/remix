import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import * as publicAdapter from '../adapter.ts'
import type { DataManipulationOperation as PublicDataManipulationOperation } from '../adapter.ts'
import type { DataManipulationOperation } from './adapter/data-manipulation.ts'
import type { DataMigrationOperation as PublicDataMigrationOperation } from '../adapter.ts'
import type { DataMigrationOperation } from './adapter/migration.ts'
import type { DatabaseAdapter as PublicDatabaseAdapter } from '../adapter.ts'
import type { DatabaseAdapter } from './adapter/runtime.ts'
import type { TransactionOptions as PublicTransactionOptions } from '../adapter.ts'
import type { TransactionOptions } from './adapter/runtime.ts'

type Equal<left, right> =
  (<value>() => value extends left ? 1 : 2) extends <value>() => value extends right ? 1 : 2
    ? true
    : false

function expectType<condition extends true>(_value?: condition): void {}

describe('adapter barrel', () => {
  it('keeps the focused internals aligned with the adapter barrel', () => {
    expectType<Equal<PublicDataManipulationOperation, DataManipulationOperation>>()
    expectType<Equal<PublicDataMigrationOperation, DataMigrationOperation>>()
    expectType<Equal<PublicDatabaseAdapter, DatabaseAdapter>>()
    expectType<Equal<PublicTransactionOptions, TransactionOptions>>()
  })

  it('does not widen the public adapter subpath runtime surface', () => {
    assert.deepEqual(Object.keys(publicAdapter).sort(), [
      'getTableColumnDefinitions',
      'getTableName',
      'getTablePrimaryKey',
    ])
  })
})
