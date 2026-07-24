import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { runRemixDb } from './cli.ts'
import { Database } from './lib/database.ts'
import type {
  DatabaseMigrateOptions,
  DatabaseMigrationStatusOptions,
  DatabaseResetOptions,
  MigrateResult,
  Migrations,
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
  migrateOptions: DatabaseMigrateOptions | undefined
  migrateResult: MigrateResult = { applied: [], reverted: [], sql: [] }
  resetSeed: Seed | undefined
  resetJournalTable: string | undefined
  statusOptions: DatabaseMigrationStatusOptions | undefined

  constructor() {
    super(createRecordingAdapter().adapter)
  }

  override async wipe(): Promise<void> {
    this.calls.push('wipe')
  }

  override async migrate(
    _migrations: Migrations,
    options?: DatabaseMigrateOptions,
  ): Promise<MigrateResult> {
    this.calls.push('migrate')
    this.migrateOptions = options
    return this.migrateResult
  }

  override async migrationStatus(
    _migrations: Migrations,
    options?: DatabaseMigrationStatusOptions,
  ): Promise<MigrationStatusEntry[]> {
    this.calls.push('status')
    this.statusOptions = options
    return []
  }

  override async reset(options: DatabaseResetOptions): Promise<void> {
    this.calls.push('reset')
    this.resetSeed = options.seed
    this.resetJournalTable = options.journalTable
  }
}

async function captureLog<result>(
  run: () => Promise<result>,
): Promise<{ value: result; lines: string[] }> {
  let lines: string[] = []
  let originalLog = console.log

  console.log = (...args: unknown[]) => {
    lines.push(args.join(' '))
  }

  try {
    let value = await run()
    return { value, lines }
  } finally {
    console.log = originalLog
  }
}

describe('runRemixDb', () => {
  it('migrates to the requested migration id and prints applied migrations', async () => {
    let db = new RecordingDatabase()
    db.migrateResult = {
      applied: [{ id: '20260715123000', name: 'create_users', status: 'applied' }],
      reverted: [],
      sql: [],
    }

    let { value: exitCode, lines } = await captureLog(() =>
      runRemixDb({
        command: 'migrate',
        db,
        migrations,
        to: '20260715123000_create_users',
      }),
    )

    assert.equal(exitCode, 0)
    assert.deepEqual(db.calls, ['migrate'])
    assert.equal(db.migrateOptions?.to, '20260715123000_create_users')
    assert.deepEqual(lines, ['applied 20260715123000_create_users'])
  })

  it('prints a notice when no migrations are pending', async () => {
    let db = new RecordingDatabase()

    let { lines } = await captureLog(() =>
      runRemixDb({
        command: 'migrate',
        db,
        migrations,
      }),
    )

    assert.deepEqual(lines, ['no pending migrations'])
  })

  it('wipes the database', async () => {
    let db = new RecordingDatabase()
    let exitCode = await runRemixDb({ command: 'wipe', db })

    assert.equal(exitCode, 0)
    assert.deepEqual(db.calls, ['wipe'])
  })

  it('resets with the loaded migrations and seed function', async () => {
    let db = new RecordingDatabase()
    let seed: Seed = () => undefined

    let { value: exitCode, lines } = await captureLog(() =>
      runRemixDb({
        command: 'reset',
        db,
        migrations,
        seed,
        journalTable: 'app_migrations',
      }),
    )

    assert.equal(exitCode, 0)
    assert.deepEqual(db.calls, ['reset'])
    assert.equal(db.resetSeed, seed)
    assert.equal(db.resetJournalTable, 'app_migrations')
    assert.deepEqual(lines, ['database reset'])
  })

  it('runs the application seed function', async () => {
    let db = new RecordingDatabase()
    let seededDatabase: Database | undefined

    let { value: exitCode, lines } = await captureLog(() =>
      runRemixDb({
        command: 'seed',
        db,
        seed(database) {
          seededDatabase = database
        },
      }),
    )

    assert.equal(exitCode, 0)
    assert.equal(seededDatabase, db)
    assert.deepEqual(lines, ['database seeded'])
  })

  it('loads migration status', async () => {
    let db = new RecordingDatabase()

    let exitCode = await runRemixDb({
      command: 'status',
      db,
      migrations,
      journalTable: 'app_migrations',
    })

    assert.equal(exitCode, 0)
    assert.deepEqual(db.calls, ['status'])
    assert.equal(db.statusOptions?.journalTable, 'app_migrations')
  })

  it('rejects unknown commands without touching the database', async () => {
    let db = new RecordingDatabase()

    await assert.rejects(
      () => runRemixDb({ command: 'drop', db } as never),
      /Unknown database command: drop/,
    )
    assert.deepEqual(db.calls, [])
  })
})
