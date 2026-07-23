import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { runDataTableCommand } from './cli.ts'
import { Database } from './lib/database.ts'
import type {
  MigrateOptions,
  MigrateResult,
  Migrations,
  MigrationRunnerOptions,
  MigrationStatusEntry,
  Seed,
} from './lib/migrations.ts'
import { createRecordingAdapter } from '../test/recording-adapter.ts'

const migrations: Migrations = [
  {
    id: '20260715123000_create_users',
    name: 'create_users',
    up: 'create table users (id integer)',
  },
]

class RecordingDatabase extends Database {
  calls: string[] = []
  migrateOptions: (MigrateOptions & MigrationRunnerOptions) | undefined
  resetSeed: Seed | undefined

  constructor() {
    super(createRecordingAdapter().adapter)
  }

  override async wipe(): Promise<void> {
    this.calls.push('wipe')
  }

  override async migrate(
    _migrations: Migrations,
    options?: MigrateOptions & MigrationRunnerOptions,
  ): Promise<MigrateResult> {
    this.calls.push('migrate')
    this.migrateOptions = options
    return { applied: [], reverted: [], sql: [] }
  }

  override async migrationStatus(
    _migrations: Migrations,
    _options?: MigrationRunnerOptions,
  ): Promise<MigrationStatusEntry[]> {
    this.calls.push('status')
    return []
  }

  override async reset(options: { migrations: Migrations; seed?: Seed }): Promise<void> {
    this.calls.push('reset')
    this.resetSeed = options.seed
  }
}

describe('runDataTableCommand', () => {
  it('migrates to the requested migration id', async () => {
    let db = new RecordingDatabase()
    let getMigrationsCalls = 0

    let exitCode = await runDataTableCommand({
      command: 'migrate',
      db,
      getMigrations() {
        getMigrationsCalls += 1
        return migrations
      },
      to: '20260715123000_create_users',
    })

    assert.equal(exitCode, 0)
    assert.equal(getMigrationsCalls, 1)
    assert.deepEqual(db.calls, ['migrate'])
    assert.equal(db.migrateOptions?.to, '20260715123000_create_users')
  })

  it('wipes the database', async () => {
    let db = new RecordingDatabase()
    let exitCode = await runDataTableCommand({ command: 'wipe', db })

    assert.equal(exitCode, 0)
    assert.deepEqual(db.calls, ['wipe'])
  })

  it('resets with the loaded migrations and seed function', async () => {
    let db = new RecordingDatabase()
    let seed: Seed = () => undefined

    let exitCode = await runDataTableCommand({
      command: 'reset',
      db,
      getMigrations() {
        return migrations
      },
      seed,
    })

    assert.equal(exitCode, 0)
    assert.deepEqual(db.calls, ['reset'])
    assert.equal(db.resetSeed, seed)
  })

  it('runs the application seed function', async () => {
    let db = new RecordingDatabase()
    let seededDatabase: Database | undefined

    let exitCode = await runDataTableCommand({
      command: 'seed',
      db,
      seed(database) {
        seededDatabase = database
      },
    })

    assert.equal(exitCode, 0)
    assert.equal(seededDatabase, db)
  })

  it('loads migration status', async () => {
    let db = new RecordingDatabase()

    let exitCode = await runDataTableCommand({
      command: 'status',
      db,
      getMigrations() {
        return migrations
      },
    })

    assert.equal(exitCode, 0)
    assert.deepEqual(db.calls, ['status'])
  })
})
