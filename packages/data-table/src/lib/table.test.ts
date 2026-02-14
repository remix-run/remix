import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { number, string } from '@remix-run/data-schema'

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
