import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { number, parseSafe, string } from '@remix-run/data-schema'

import {
  columnMetadataKey,
  createTable,
  getTableName,
  getTablePrimaryKey,
  getTableReference,
  hasMany,
  tableMetadataKey,
} from './table.ts'

describe('table metadata', () => {
  it('stores table internals on a symbol key and exposes column refs as properties', () => {
    let users = createTable({
      name: 'users',
      columns: {
        id: number(),
        email: string(),
      },
    })

    assert.deepEqual(Object.keys(users).sort(), ['email', 'id'])
    assert.equal('name' in users, false)
    assert.equal(getTableName(users), 'users')
    assert.deepEqual(getTablePrimaryKey(users), ['id'])

    let tableReference = getTableReference(users)
    assert.equal(tableReference.name, 'users')
    assert.equal(tableReference.kind, 'table')
    assert.equal(users.id[columnMetadataKey].qualifiedName, 'users.id')
    assert.equal(users[tableMetadataKey].name, 'users')
  })

  it('is standard-schema compatible with create-style validation semantics', () => {
    let users = createTable({
      name: 'users',
      columns: {
        id: number(),
        email: string(),
      },
    })

    let partialResult = parseSafe(users, { id: 1 })
    assert.equal(partialResult.success, true)

    if (partialResult.success) {
      assert.deepEqual(partialResult.value, { id: 1 })
    }

    let unknownKeyResult = parseSafe(users, { id: 1, extra: 'x' })
    assert.equal(unknownKeyResult.success, false)

    if (!unknownKeyResult.success) {
      assert.deepEqual(unknownKeyResult.issues[0].path, ['extra'])
      assert.match(unknownKeyResult.issues[0].message, /Unknown column "extra"/)
    }

    let invalidValueResult = parseSafe(users, { id: 'not-a-number' })
    assert.equal(invalidValueResult.success, false)

    if (!invalidValueResult.success) {
      assert.deepEqual(invalidValueResult.issues[0].path, ['id'])
    }
  })

  it('builds relations with functional helpers', () => {
    let users = createTable({
      name: 'users',
      columns: {
        id: number(),
      },
    })
    let orders = createTable({
      name: 'orders',
      columns: {
        id: number(),
        user_id: number(),
      },
    })

    let userOrders = hasMany(users, orders).orderBy(orders.id)

    assert.deepEqual(userOrders.sourceKey, ['id'])
    assert.deepEqual(userOrders.targetKey, ['user_id'])
    assert.equal(userOrders.modifiers.orderBy[0].column, 'orders.id')
  })
})
