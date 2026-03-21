import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { column } from './column.ts'
import { table } from './table.ts'
import { belongsTo, hasMany, hasManyThrough, hasOne } from './table-relations.ts'

describe('table relations', () => {
  it('infers default keys for direct relation helpers', () => {
    let accounts = table({
      name: 'accounts',
      columns: {
        id: column.integer(),
      },
    })
    let projects = table({
      name: 'projects',
      columns: {
        id: column.integer(),
        account_id: column.integer(),
      },
    })
    let profiles = table({
      name: 'profiles',
      columns: {
        id: column.integer(),
        account_id: column.integer(),
      },
    })

    let accountProjects = hasMany(accounts, projects)
    let accountProfile = hasOne(accounts, profiles)
    let projectAccount = belongsTo(projects, accounts)

    assert.deepEqual(accountProjects.sourceKey, ['id'])
    assert.deepEqual(accountProjects.targetKey, ['account_id'])
    assert.deepEqual(accountProfile.sourceKey, ['id'])
    assert.deepEqual(accountProfile.targetKey, ['account_id'])
    assert.deepEqual(projectAccount.sourceKey, ['account_id'])
    assert.deepEqual(projectAccount.targetKey, ['id'])
  })

  it('supports explicit key selectors', () => {
    let memberships = table({
      name: 'memberships',
      primaryKey: ['organization_id', 'account_id'],
      columns: {
        organization_id: column.integer(),
        account_id: column.integer(),
        role: column.text(),
      },
    })
    let permissions = table({
      name: 'permissions',
      columns: {
        id: column.integer(),
        organization_id: column.integer(),
        account_id: column.integer(),
        code: column.text(),
      },
    })

    let membershipPermissions = hasMany(memberships, permissions, {
      targetKey: ['organization_id', 'account_id'],
      foreignKey: ['organization_id', 'account_id'],
    })

    assert.deepEqual(membershipPermissions.sourceKey, ['organization_id', 'account_id'])
    assert.deepEqual(membershipPermissions.targetKey, ['organization_id', 'account_id'])
  })

  it('returns new relation instances when modifiers are chained', () => {
    let accounts = table({
      name: 'accounts',
      columns: {
        id: column.integer(),
      },
    })
    let projects = table({
      name: 'projects',
      columns: {
        id: column.integer(),
        account_id: column.integer(),
        archived: column.boolean(),
      },
    })

    let base = hasMany(accounts, projects)
    let filtered = base.where({ archived: false }).orderBy(projects.id, 'desc').limit(5).offset(1)

    assert.notEqual(filtered, base)
    assert.equal(base.modifiers.where.length, 0)
    assert.equal(base.modifiers.orderBy.length, 0)
    assert.equal(base.modifiers.limit, undefined)
    assert.equal(base.modifiers.offset, undefined)
    assert.deepEqual(base.modifiers.with, {})
    assert.equal(filtered.modifiers.where.length, 1)
    assert.deepEqual(filtered.modifiers.orderBy, [{ column: 'projects.id', direction: 'desc' }])
    assert.equal(filtered.modifiers.limit, 5)
    assert.equal(filtered.modifiers.offset, 1)
  })

  it('validates hasManyThrough source tables', () => {
    let accounts = table({
      name: 'accounts',
      columns: {
        id: column.integer(),
      },
    })
    let organizations = table({
      name: 'organizations',
      columns: {
        id: column.integer(),
      },
    })
    let projects = table({
      name: 'projects',
      columns: {
        id: column.integer(),
        organization_id: column.integer(),
      },
    })
    let tasks = table({
      name: 'tasks',
      columns: {
        id: column.integer(),
        project_id: column.integer(),
      },
    })

    let organizationProjects = hasMany(organizations, projects)

    assert.throws(
      () =>
        hasManyThrough(accounts, tasks, {
          through: organizationProjects as never,
        }),
      /hasManyThrough expects a through relation whose source table matches accounts/,
    )
  })

  it('throws when relation key lengths do not match', () => {
    let memberships = table({
      name: 'memberships',
      primaryKey: ['organization_id', 'account_id'],
      columns: {
        organization_id: column.integer(),
        account_id: column.integer(),
      },
    })
    let permissions = table({
      name: 'permissions',
      columns: {
        id: column.integer(),
        organization_id: column.integer(),
        account_id: column.integer(),
      },
    })

    assert.throws(
      () =>
        hasMany(memberships, permissions, {
          targetKey: ['organization_id', 'account_id'],
          foreignKey: 'organization_id',
        }),
      /Relation key mismatch between "memberships"/,
    )
  })
})
