import { after, before, describe } from 'node:test'
import { createDatabase } from '@remix-run/data-table'
import { Pool } from 'pg'

import { runAdapterIntegrationContract } from '../../../data-table/test-support/adapter-integration-contract.ts'

import { createPostgresDatabaseAdapter } from './adapter.ts'

let integrationEnabled =
  process.env.DATA_TABLE_INTEGRATION === '1' &&
  typeof process.env.DATA_TABLE_POSTGRES_URL === 'string'

describe('postgres adapter integration', () => {
  let pool: Pool

  before(async () => {
    if (!integrationEnabled) {
      return
    }

    pool = new Pool({ connectionString: process.env.DATA_TABLE_POSTGRES_URL })
    await pool.query('drop table if exists tasks')
    await pool.query('drop table if exists projects')
    await pool.query('drop table if exists accounts')
    await pool.query(
      [
        'create table accounts (',
        '  id integer primary key,',
        '  email text not null,',
        '  status text not null,',
        '  nickname text',
        ')',
      ].join('\n'),
    )
    await pool.query(
      [
        'create table projects (',
        '  id integer primary key,',
        '  account_id integer not null,',
        '  name text not null,',
        '  archived boolean not null',
        ')',
      ].join('\n'),
    )
    await pool.query(
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

    await pool.query('drop table if exists tasks')
    await pool.query('drop table if exists projects')
    await pool.query('drop table if exists accounts')
    await pool.end()
  })

  runAdapterIntegrationContract({
    integrationEnabled,
    createDatabase: () => createDatabase(createPostgresDatabaseAdapter(pool)),
    resetDatabase: async () => {
      await pool.query('delete from tasks')
      await pool.query('delete from projects')
      await pool.query('delete from accounts')
    },
  })
})
