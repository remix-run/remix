import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { runRemix } from '../../index.ts'
import { captureOutput } from '../../../test/capture-output.ts'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..')

describe('db command', () => {
  it('prints database command help', async () => {
    let result = await captureOutput(() => runRemix(['db', '--help']))
    let helpResult = await captureOutput(() => runRemix(['help', 'db']))

    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout, helpResult.stdout)
    assert.equal(result.stderr, '')
    assert.match(result.stdout, /--connection-env <name>/)
    assert.match(result.stdout, /--journal-table <name>/)
    assert.match(result.stdout, /--migrations <path>/)
    assert.match(result.stdout, /--seed <path>/)
    assert.match(result.stdout, /--to <migration>/)
  })

  it('refuses destructive database commands without --force', async () => {
    let wipe = await captureOutput(() => runRemix(['db', 'wipe']))
    let reset = await captureOutput(() => runRemix(['db', 'reset']))

    assert.equal(wipe.exitCode, 1)
    assert.match(wipe.stderr, /RMX_DB_FORCE_REQUIRED/)
    assert.match(wipe.stderr, /`remix db wipe` destroys data/)
    assert.equal(reset.exitCode, 1)
    assert.match(reset.stderr, /RMX_DB_FORCE_REQUIRED/)
  })

  it('runs migrate, status, wipe, reset, and seed from static configuration', async () => {
    let projectDir = await createDatabaseProject()

    try {
      let migrate = await captureOutput(() => runRemix(['db', 'migrate'], { cwd: projectDir }))
      assert.equal(migrate.exitCode, 0, migrate.stderr)
      assert.match(migrate.stdout, /applied 20260715120000_create_first/)
      assert.match(migrate.stdout, /applied 20260715130000_create_second/)

      let status = await captureOutput(() => runRemix(['db', 'status'], { cwd: projectDir }))
      assert.equal(status.exitCode, 0, status.stderr)
      assert.match(status.stdout, /20260715120000 create_first applied/)

      let wipe = await captureOutput(() => runRemix(['db', 'wipe', '--force'], { cwd: projectDir }))
      assert.equal(wipe.exitCode, 0, wipe.stderr)
      assert.equal(readTableNames(projectDir).includes('first_table'), false)

      let reset = await captureOutput(() =>
        runRemix(['db', 'reset', '--force'], { cwd: projectDir }),
      )
      assert.equal(reset.exitCode, 0, reset.stderr)
      assert.match(reset.stdout, /seed stdout/)
      assert.ok(readTableNames(projectDir).includes('second_table'))

      let seed = await captureOutput(() => runRemix(['db', 'seed'], { cwd: projectDir }))
      assert.equal(seed.exitCode, 0, seed.stderr)
      assert.equal(seed.stdout, 'seed stdout\n')
      assert.equal(seed.stderr, 'seed stderr\n')
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('applies a targeted migration', async () => {
    let projectDir = await createDatabaseProject()

    try {
      let result = await captureOutput(() =>
        runRemix(['db', 'migrate', '--to', '20260715120000_create_first'], {
          cwd: projectDir,
        }),
      )

      assert.equal(result.exitCode, 0, result.stderr)
      let tables = readTableNames(projectDir)
      assert.ok(tables.includes('first_table'))
      assert.equal(tables.includes('second_table'), false)
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('finds remix.json from a project subdirectory', async () => {
    let projectDir = await createDatabaseProject()

    try {
      let result = await captureOutput(() =>
        runRemix(['db', 'status'], { cwd: path.join(projectDir, 'app') }),
      )
      assert.equal(result.exitCode, 0, result.stderr)
      assert.match(result.stdout, /20260715120000 create_first pending/)
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('uses an explicitly selected config instead of the nearest remix.json', async () => {
    let projectDir = await createDatabaseProject()

    try {
      await fs.rename(path.join(projectDir, 'remix.json'), path.join(projectDir, 'database.json'))
      await fs.writeFile(path.join(projectDir, 'remix.json'), '{}', 'utf8')

      let result = await captureOutput(() =>
        runRemix(['--config', './database.json', 'db', 'status'], { cwd: projectDir }),
      )
      assert.equal(result.exitCode, 0, result.stderr)
      assert.match(result.stdout, /20260715120000 create_first pending/)
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('uses command-line paths and connection environment variables over config', async () => {
    let projectDir = await createDatabaseProject({ migrationsDirectory: './missing' })
    let overrideDatabase = path.join(projectDir, 'override.sqlite')
    let previous = process.env.REMIX_TEST_DATABASE
    process.env.REMIX_TEST_DATABASE = overrideDatabase

    try {
      let result = await captureOutput(() =>
        runRemix(
          [
            'db',
            'migrate',
            '--connection-env',
            'REMIX_TEST_DATABASE',
            '--migrations',
            path.join(projectDir, 'db/migrations'),
            '--journal-table',
            'custom_migrations',
          ],
          { cwd: projectDir },
        ),
      )
      assert.equal(result.exitCode, 0, result.stderr)

      let sqlite = new DatabaseSync(overrideDatabase)
      let journal = sqlite
        .prepare(
          "select name from sqlite_master where type = 'table' and name = 'custom_migrations'",
        )
        .get()
      sqlite.close()
      assert.ok(journal)
    } finally {
      if (previous === undefined) delete process.env.REMIX_TEST_DATABASE
      else process.env.REMIX_TEST_DATABASE = previous
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('loads a configured custom database factory', async () => {
    let projectDir = await createDatabaseProject({ customAdapter: true })

    try {
      let result = await captureOutput(() => runRemix(['db', 'status'], { cwd: projectDir }))
      assert.equal(result.exitCode, 0, result.stderr)
      assert.match(result.stdout, /20260715120000 create_first pending/)
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('does not load seed code for commands that do not use it', async () => {
    let projectDir = await createDatabaseProject({ throwingSeed: true })

    try {
      let status = await captureOutput(() => runRemix(['db', 'status'], { cwd: projectDir }))
      assert.equal(status.exitCode, 0, status.stderr)

      let seed = await captureOutput(() => runRemix(['db', 'seed'], { cwd: projectDir }))
      assert.equal(seed.exitCode, 1)
      assert.match(seed.stderr, /seed module boom/)
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('does not load migrations for commands that do not use them', async () => {
    let projectDir = await createDatabaseProject({ migrationsDirectory: './missing' })

    try {
      let seed = await captureOutput(() => runRemix(['db', 'seed'], { cwd: projectDir }))
      assert.equal(seed.exitCode, 0, seed.stderr)
      assert.equal(seed.stdout, 'seed stdout\n')
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('reports missing configuration required by a command', async () => {
    let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-db-command-'))

    try {
      await fs.writeFile(path.join(projectDir, 'remix.json'), '{}', 'utf8')
      let missingDb = await captureOutput(() => runRemix(['db', 'status'], { cwd: projectDir }))
      assert.equal(missingDb.exitCode, 1)
      assert.match(missingDb.stderr, /RMX_DB_CONFIG_REQUIRED/)

      await fs.writeFile(
        path.join(projectDir, 'remix.json'),
        JSON.stringify({ db: { adapter: { type: 'sqlite', filename: './database.sqlite' } } }),
        'utf8',
      )
      let missingMigrations = await captureOutput(() =>
        runRemix(['db', 'status'], { cwd: projectDir }),
      )
      assert.equal(missingMigrations.exitCode, 1)
      assert.match(missingMigrations.stderr, /requires db\.migrations\.directory or --migrations/)
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('reports unknown subcommands and invalid command options', async () => {
    let unknown = await captureOutput(() => runRemix(['db', 'wat']))
    let invalid = await captureOutput(() => runRemix(['db', 'migrate', '--seed', './seed.ts']))

    assert.equal(unknown.exitCode, 1)
    assert.match(unknown.stderr, /Unknown command: db wat/)
    assert.equal(invalid.exitCode, 1)
    assert.match(invalid.stderr, /Unknown argument: --seed/)
  })
})

function readTableNames(projectDir: string): unknown[] {
  let sqlite = new DatabaseSync(path.join(projectDir, 'database.sqlite'))
  let tables = sqlite
    .prepare("select name from sqlite_master where type = 'table' order by name")
    .all()
    .map((row) => row.name)
  sqlite.close()
  return tables
}

async function createDatabaseProject(
  options: {
    customAdapter?: boolean
    migrationsDirectory?: string
    throwingSeed?: boolean
  } = {},
): Promise<string> {
  let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-db-command-'))
  await fs.mkdir(path.join(projectDir, 'app'), { recursive: true })
  await fs.mkdir(path.join(projectDir, 'db/migrations/20260715120000_create_first'), {
    recursive: true,
  })
  await fs.mkdir(path.join(projectDir, 'db/migrations/20260715130000_create_second'), {
    recursive: true,
  })
  await fs.mkdir(path.join(projectDir, 'node_modules'), { recursive: true })
  await fs.symlink(
    path.join(ROOT_DIR, 'packages/remix'),
    path.join(projectDir, 'node_modules/remix'),
  )

  await fs.writeFile(
    path.join(projectDir, 'package.json'),
    `${JSON.stringify({ name: 'database-command-fixture', private: true, type: 'module' }, null, 2)}\n`,
    'utf8',
  )
  await fs.writeFile(
    path.join(projectDir, 'db/migrations/20260715120000_create_first/up.sql'),
    'create table first_table (id integer primary key);\n',
    'utf8',
  )
  await fs.writeFile(
    path.join(projectDir, 'db/migrations/20260715120000_create_first/down.sql'),
    'drop table first_table;\n',
    'utf8',
  )
  await fs.writeFile(
    path.join(projectDir, 'db/migrations/20260715130000_create_second/up.sql'),
    'create table second_table (id integer primary key);\n',
    'utf8',
  )
  await fs.writeFile(
    path.join(projectDir, 'app/seed.ts'),
    options.throwingSeed
      ? "throw new Error('seed module boom')\n"
      : [
          'export function seed() {',
          "  console.log('seed stdout')",
          "  console.error('seed stderr')",
          '}',
          '',
        ].join('\n'),
    'utf8',
  )

  let adapter: Record<string, unknown> = {
    type: 'sqlite',
    filename: './database.sqlite',
    foreignKeys: true,
  }
  if (options.customAdapter) {
    adapter = { type: 'module', module: './app/database.ts' }
    await fs.writeFile(
      path.join(projectDir, 'app/database.ts'),
      [
        "import { createDatabase as createDataTableDatabase } from 'remix/data-table'",
        "import { createSqliteDatabaseAdapter } from 'remix/data-table/sqlite'",
        '',
        'export function createDatabase() {',
        "  return createDataTableDatabase(createSqliteDatabaseAdapter({ filename: './database.sqlite' }))",
        '}',
        '',
      ].join('\n'),
      'utf8',
    )
  }

  await fs.writeFile(
    path.join(projectDir, 'remix.json'),
    JSON.stringify(
      {
        db: {
          adapter,
          migrations: { directory: options.migrationsDirectory ?? './db/migrations' },
          seed: { module: './app/seed.ts' },
        },
      },
      null,
      2,
    ),
    'utf8',
  )
  return projectDir
}
