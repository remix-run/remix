import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { column } from './column.ts'
import {
  columnMetadataKey,
  fail,
  getTableAfterDelete,
  getTableAfterRead,
  getTableAfterWrite,
  getTableBeforeDelete,
  getTableBeforeWrite,
  getTableValidator,
  getTableName,
  getTablePrimaryKey,
  getTableReference,
  hasMany,
  table,
  tableMetadataKey,
} from './table.ts'

describe('table metadata', () => {
  it('stores table internals on a symbol key and exposes column refs as properties', () => {
    let users = table({
      name: 'users',
      columns: {
        id: column.integer(),
        email: column.text(),
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

  it('supports an optional table-level validator hook', () => {
    let calls: Array<'create' | 'update'> = []
    let users = table({
      name: 'users',
      columns: {
        id: column.integer(),
        email: column.text(),
      },
      validate({ operation, value }) {
        calls.push(operation)

        if (operation === 'create') {
          return {
            value: {
              ...value,
              id: typeof value.id === 'string' ? Number(value.id) : value.id,
            },
          }
        }

        return {
          value,
        }
      },
    })

    let validator = getTableValidator(users)
    assert.ok(validator)
    if (!validator) {
      throw new Error('Expected validator')
    }

    let createResult = validator({
      operation: 'create',
      tableName: 'users',
      value: { id: '1' as never },
    })
    assert.deepEqual(createResult, { value: { id: 1 } })

    let updateResult = validator({ operation: 'update', tableName: 'users', value: { id: 2 } })
    assert.deepEqual(updateResult, { value: { id: 2 } })

    assert.deepEqual(calls, ['create', 'update'])
  })

  it('creates validation failure results with fail()', () => {
    assert.deepEqual(fail('Expected email', ['email']), {
      issues: [{ message: 'Expected email', path: ['email'] }],
    })

    assert.deepEqual(
      fail([
        { message: 'Missing id', path: ['id'] },
        { message: 'Missing email', path: ['email'] },
      ]),
      {
        issues: [
          { message: 'Missing id', path: ['id'] },
          { message: 'Missing email', path: ['email'] },
        ],
      },
    )
  })

  it('stores optional lifecycle callbacks on table metadata', () => {
    let beforeWrite = () => ({ value: {} })
    let afterWrite = () => {}
    let beforeDelete = () => undefined
    let afterDelete = () => {}
    let afterRead = ({ value }: { value: Partial<{ id: number }> }) => ({ value })

    let users = table({
      name: 'users',
      columns: {
        id: column.integer(),
      },
      beforeWrite,
      afterWrite,
      beforeDelete,
      afterDelete,
      afterRead,
    })

    assert.equal(getTableBeforeWrite(users), beforeWrite)
    assert.equal(getTableAfterWrite(users), afterWrite)
    assert.equal(getTableBeforeDelete(users), beforeDelete)
    assert.equal(getTableAfterDelete(users), afterDelete)
    assert.equal(getTableAfterRead(users), afterRead)
  })

  it('builds relations with functional helpers', () => {
    let users = table({
      name: 'users',
      columns: {
        id: column.integer(),
      },
    })
    let orders = table({
      name: 'orders',
      columns: {
        id: column.integer(),
        user_id: column.integer(),
      },
    })

    let userOrders = hasMany(users, orders).orderBy(orders.id)

    assert.deepEqual(userOrders.sourceKey, ['id'])
    assert.deepEqual(userOrders.targetKey, ['user_id'])
    assert.equal(userOrders.modifiers.orderBy[0].column, 'orders.id')
  })
})
