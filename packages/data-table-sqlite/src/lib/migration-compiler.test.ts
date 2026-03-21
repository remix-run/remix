import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { DataMigrationOperation } from '@remix-run/data-table/adapter'

import { compileSqliteMigrationOperations } from './migration-compiler.ts'

describe('sqlite migration-compiler', () => {
  it('compiles createTable operations with sqlite quoting and defaults', () => {
    let operation = {
      kind: 'createTable',
      table: { schema: 'app', name: 'users' },
      columns: {
        id: {
          type: 'integer',
          nullable: false,
        },
        name: {
          type: 'text',
          default: {
            kind: 'literal',
            value: "o'hare",
          },
        },
      },
      primaryKey: {
        name: 'users_pkey',
        columns: ['id'],
      },
      foreignKeys: [
        {
          name: 'users_org_id_fkey',
          columns: ['org_id'],
          references: {
            table: { schema: 'app', name: 'orgs' },
            columns: ['id'],
          },
          onDelete: 'cascade',
          onUpdate: 'restrict',
        },
      ],
    } satisfies DataMigrationOperation

    assert.deepEqual(compileSqliteMigrationOperations(operation), [
      {
        text:
          'create table "app"."users" (' +
          '"id" integer not null, ' +
          '"name" text default \'o\'\'hare\', ' +
          'constraint "users_pkey" primary key ("id"), ' +
          'constraint "users_org_id_fkey" foreign key ("org_id") references "app"."orgs" ("id") ' +
          'on delete cascade on update restrict' +
          ')',
        values: [],
      },
    ])
  })

  it('compiles addForeignKey operations with shared constraint formatting', () => {
    let operation = {
      kind: 'addForeignKey',
      table: { name: 'users' },
      constraint: {
        name: 'users_org_id_fkey',
        columns: ['org_id'],
        references: {
          table: { schema: 'app', name: 'orgs' },
          columns: ['id'],
        },
        onDelete: 'cascade',
        onUpdate: 'restrict',
      },
    } satisfies DataMigrationOperation

    assert.deepEqual(compileSqliteMigrationOperations(operation), [
      {
        text:
          'alter table "users" add ' +
          'constraint "users_org_id_fkey" foreign key ("org_id") references "app"."orgs" ("id") ' +
          'on delete cascade on update restrict',
        values: [],
      },
    ])
  })
})
