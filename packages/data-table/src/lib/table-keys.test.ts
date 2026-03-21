import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { column } from './column.ts'
import { table } from './table.ts'
import { getCompositeKey, getPrimaryKeyObject } from './table-keys.ts'

describe('table keys', () => {
  it('normalizes scalar primary key inputs', () => {
    let users = table({
      name: 'users',
      columns: {
        id: column.integer(),
        email: column.text(),
      },
    })

    assert.deepEqual(getPrimaryKeyObject(users, 123), { id: 123 })
  })

  it('normalizes composite primary key inputs', () => {
    let memberships = table({
      name: 'memberships',
      primaryKey: ['organization_id', 'account_id'],
      columns: {
        organization_id: column.integer(),
        account_id: column.integer(),
        role: column.text(),
      },
    })

    assert.deepEqual(getPrimaryKeyObject(memberships, { organization_id: 1, account_id: 2 }), {
      organization_id: 1,
      account_id: 2,
    })
  })

  it('throws when a composite primary key input is missing a key', () => {
    let memberships = table({
      name: 'memberships',
      primaryKey: ['organization_id', 'account_id'],
      columns: {
        organization_id: column.integer(),
        account_id: column.integer(),
      },
    })

    assert.throws(
      () => getPrimaryKeyObject(memberships, { organization_id: 1 } as never),
      /Missing key "account_id" for primary key lookup on "memberships"/,
    )
  })

  it('builds composite tuple keys from serialized values', () => {
    let row = {
      account_id: 3,
      slug: 'alpha',
      happened_at: new Date('2026-01-01T00:00:00.000Z'),
    }

    assert.equal(
      getCompositeKey(row, ['account_id', 'slug', 'happened_at']),
      '3::"alpha"::date:2026-01-01T00:00:00.000Z',
    )
  })
})
