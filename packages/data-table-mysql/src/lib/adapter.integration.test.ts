import { after, before, describe } from 'node:test'
import { createDatabase } from '@remix-run/data-table'
import { createPool, type Pool } from 'mysql2/promise'

import { runAdapterIntegrationContract } from '../../../data-table/test-support/adapter-integration-contract.ts'

import { createMysqlDatabaseAdapter } from './adapter.ts'

let integrationEnabled =
  process.env.DATA_TABLE_INTEGRATION === '1' && typeof process.env.DATA_TABLE_MYSQL_URL === 'string'

describe('mysql adapter integration', () => {
  let pool: Pool

  before(async () => {
    if (!integrationEnabled) {
      return
    }

    pool = createPool(process.env.DATA_TABLE_MYSQL_URL as string)
    await pool.query('drop table if exists tasks')
    await pool.query('drop table if exists projects')
    await pool.query('drop table if exists accounts')
    await pool.query(
      [
        'create table accounts (',
        '  id int primary key,',
        '  email varchar(255) not null,',
        '  status varchar(32) not null,',
        '  nickname varchar(255) null',
        ')',
      ].join('\n'),
    )
    await pool.query(
      [
        'create table projects (',
        '  id int primary key,',
        '  account_id int not null,',
        '  name varchar(255) not null,',
        '  archived boolean not null',
        ')',
      ].join('\n'),
    )
    await pool.query(
      [
        'create table tasks (',
        '  id int primary key,',
        '  project_id int not null,',
        '  title varchar(255) not null,',
        '  state varchar(32) not null',
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
    createDatabase: () => createDatabase(createMysqlDatabaseAdapter(pool)),
    resetDatabase: async () => {
      await pool.query('delete from tasks')
      await pool.query('delete from projects')
      await pool.query('delete from accounts')
    },
  })
})
