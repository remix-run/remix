import { after, before, describe } from 'node:test'
import BetterSqlite3, { type Database as BetterSqliteDatabase } from 'better-sqlite3'
import { createDatabase } from '@remix-run/data-table'

import { runAdapterIntegrationContract } from '../../../data-table/test/adapter-integration-contract.ts'

import { createSqliteDatabaseAdapter } from './adapter.ts'

let integrationEnabled = process.env.DATA_TABLE_INTEGRATION === '1' && canOpenSqliteDatabase()

describe('sqlite adapter integration', () => {
  let sqlite: BetterSqliteDatabase

  before(async () => {
    if (!integrationEnabled) {
      return
    }

    sqlite = new BetterSqlite3(':memory:')
    sqlite.exec('drop table if exists tasks')
    sqlite.exec('drop table if exists projects')
    sqlite.exec('drop table if exists accounts')
    sqlite.exec(
      [
        'create table accounts (',
        '  id integer primary key,',
        '  email text not null,',
        '  status text not null,',
        '  nickname text',
        ')',
      ].join('\n'),
    )
    sqlite.exec(
      [
        'create table projects (',
        '  id integer primary key,',
        '  account_id integer not null,',
        '  name text not null,',
        '  archived boolean not null',
        ')',
      ].join('\n'),
    )
    sqlite.exec(
      [
        'create table tasks (',
        '  id integer primary key,',
        '  project_id integer not null,',
        '  title text not null,',
        '  state text not null',
        ')',
      ].join('\n'),
    )
  })

  after(async () => {
    if (!integrationEnabled) {
      return
    }

    sqlite.exec('drop table if exists tasks')
    sqlite.exec('drop table if exists projects')
    sqlite.exec('drop table if exists accounts')
    sqlite.close()
  })

  runAdapterIntegrationContract({
    integrationEnabled,
    createDatabase: () => createDatabase(createSqliteDatabaseAdapter(sqlite)),
    resetDatabase: async () => {
      sqlite.exec('delete from tasks')
      sqlite.exec('delete from projects')
      sqlite.exec('delete from accounts')
    },
  })
})

function canOpenSqliteDatabase(): boolean {
  try {
    let database = new BetterSqlite3(':memory:')
    database.close()
    return true
  } catch {
    return false
  }
}
