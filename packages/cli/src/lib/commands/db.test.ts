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
    assert.match(result.stdout, /remix db migrate \[--to <migration>\]/)
    assert.match(result.stdout, /remix db wipe --force/)
    assert.match(result.stdout, /remix db reset --force/)
    assert.match(result.stdout, /--force\s+Confirm a destructive command \(wipe and reset only\)/)
    assert.match(
      result.stdout,
      /--to <migration>\s+Stop after applying the specified migration \(migrate only\)/,
    )
  })

  it('refuses destructive database commands without --force', async () => {
    let wipe = await captureOutput(() => runRemix(['db', 'wipe']))
    let reset = await captureOutput(() => runRemix(['db', 'reset']))

    assert.equal(wipe.exitCode, 1)
    assert.match(
      wipe.stderr,
      /Error \[RMX_DB_FORCE_REQUIRED\] Destructive database command requires --force/,
    )
    assert.match(wipe.stderr, /`remix db wipe` destroys data in the current app database\./)
    assert.match(wipe.stderr, /Re-run with --force to confirm\./)
    assert.match(wipe.stderr, /Usage:/)

    assert.equal(reset.exitCode, 1)
    assert.match(
      reset.stderr,
      /Error \[RMX_DB_FORCE_REQUIRED\] Destructive database command requires --force/,
    )
    assert.match(reset.stderr, /`remix db reset` destroys data in the current app database\./)
  })

  it('runs destructive database commands with --force', async () => {
    let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-db-command-'))

    try {
      await writeDatabaseProject(projectDir)

      let migrate = await captureOutput(() => runRemix(['db', 'migrate'], { cwd: projectDir }))
      assert.equal(migrate.exitCode, 0, migrate.stderr)

      let wipe = await captureOutput(() => runRemix(['db', 'wipe', '--force'], { cwd: projectDir }))
      assert.equal(wipe.exitCode, 0, wipe.stderr)
      assert.equal(readTableNames(projectDir).includes('first_table'), false)

      let reset = await captureOutput(() =>
        runRemix(['db', 'reset', '--force'], { cwd: projectDir }),
      )
      assert.equal(reset.exitCode, 0, reset.stderr)
      assert.match(reset.stdout, /seed stdout/)

      let tables = readTableNames(projectDir)
      assert.ok(tables.includes('first_table'))
      assert.ok(tables.includes('second_table'))
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('runs database commands from a subdirectory of the app', async () => {
    let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-db-command-'))

    try {
      await writeDatabaseProject(projectDir)

      let result = await captureOutput(() =>
        runRemix(['db', 'status'], { cwd: path.join(projectDir, 'app') }),
      )

      assert.equal(result.exitCode, 0, result.stderr)
      assert.match(result.stdout, /20260715120000_create_first create_first pending/)
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('reports a dedicated error when app/db.ts cannot be found', async () => {
    let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-db-command-'))

    try {
      let result = await captureOutput(() => runRemix(['db', 'status'], { cwd: projectDir }))

      assert.equal(result.exitCode, 1)
      assert.match(result.stderr, /Error \[RMX_DB_FILE_NOT_FOUND\] Could not find app\/db\.ts/)
      assert.match(
        result.stderr,
        /Run this command inside a Remix app that has an app\/db\.ts file\./,
      )
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('reports unknown database subcommands as usage errors', async () => {
    let result = await captureOutput(() => runRemix(['db', 'wat']))

    assert.equal(result.exitCode, 1)
    assert.match(result.stderr, /Error \[RMX_UNKNOWN_COMMAND\] Unknown command/)
    assert.match(result.stderr, /Unknown command: db wat/)
    assert.match(result.stderr, /Usage:/)
  })

  it('preserves stack traces when app/db.ts fails to load', async () => {
    let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-db-command-'))

    try {
      await writeDatabaseProject(projectDir)
      await fs.writeFile(
        path.join(projectDir, 'app', 'db.ts'),
        "throw new Error('db module boom')\n",
        'utf8',
      )

      let result = await captureOutput(() => runRemix(['db', 'status'], { cwd: projectDir }))

      assert.equal(result.exitCode, 1)
      assert.match(result.stderr, /db module boom/)
      assert.match(result.stderr, /\n\s+at /)
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('reports missing database module exports without stack noise', async () => {
    let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-db-command-'))

    try {
      await writeDatabaseProject(projectDir)
      await fs.writeFile(
        path.join(projectDir, 'app', 'db.ts'),
        [
          "import * as path from 'node:path'",
          "import { createDatabase } from 'remix/data-table'",
          "import { createSqliteDatabaseAdapter } from 'remix/data-table/sqlite'",
          '',
          'export const db = createDatabase(',
          '  createSqliteDatabaseAdapter({',
          "    filename: path.join(import.meta.dirname, '../database.sqlite'),",
          '  }),',
          ')',
          '',
        ].join('\n'),
        'utf8',
      )

      let result = await captureOutput(() => runRemix(['db', 'seed'], { cwd: projectDir }))

      assert.equal(result.exitCode, 1)
      assert.match(result.stderr, /app\/db\.ts must export a seed function to run db seed/)
      assert.doesNotMatch(result.stderr, /\n\s+at /)
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('parses typed migration options and loads full TypeScript app modules', async () => {
    let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-db-command-'))

    try {
      await writeDatabaseProject(projectDir)

      let result = await captureOutput(() =>
        runRemix(['db', 'migrate', '--to=20260715120000_create_first'], {
          cwd: projectDir,
        }),
      )

      assert.equal(result.exitCode, 0, result.stderr)
      assert.equal(result.stderr, '')

      let sqlite = new DatabaseSync(path.join(projectDir, 'database.sqlite'))
      let tables = sqlite
        .prepare("select name from sqlite_master where type = 'table' order by name")
        .all()
        .map((row) => row.name)
      sqlite.close()

      assert.ok(tables.includes('first_table'))
      assert.equal(tables.includes('second_table'), false)

      let status = await captureOutput(() => runRemix(['db', 'status'], { cwd: projectDir }))
      assert.equal(status.exitCode, 0, status.stderr)
      assert.match(status.stdout, /20260715120000_create_first create_first applied/)
      assert.match(status.stdout, /20260715130000_create_second create_second pending/)
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('reports invalid database arguments as CLI usage errors', async () => {
    let unknown = await captureOutput(() => runRemix(['db', 'migrate', '--wat']))
    let missing = await captureOutput(() => runRemix(['db', 'migrate', '--to=']))

    assert.equal(unknown.exitCode, 1)
    assert.match(unknown.stderr, /Error \[RMX_UNKNOWN_ARGUMENT\] Unknown argument/)
    assert.match(unknown.stderr, /Unknown argument: --wat/)
    assert.match(unknown.stderr, /Usage:/)

    assert.equal(missing.exitCode, 1)
    assert.match(missing.stderr, /Error \[RMX_MISSING_OPTION_VALUE\] Missing option value/)
    assert.match(missing.stderr, /--to requires a value/)
    assert.match(missing.stderr, /Usage:/)
  })

  it('preserves application output written to both output streams', async () => {
    let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-db-command-'))

    try {
      await writeDatabaseProject(projectDir)

      let result = await captureOutput(() => runRemix(['db', 'seed'], { cwd: projectDir }))

      assert.equal(result.exitCode, 0, result.stderr)
      assert.equal(result.stdout, 'seed stdout\n')
      assert.equal(result.stderr, 'seed stderr\n')
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
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

async function writeDatabaseProject(projectDir: string): Promise<void> {
  await fs.mkdir(path.join(projectDir, 'app'), { recursive: true })
  await fs.mkdir(path.join(projectDir, 'node_modules'), { recursive: true })
  await fs.symlink(
    path.join(ROOT_DIR, 'packages', 'remix'),
    path.join(projectDir, 'node_modules', 'remix'),
  )
  await fs.writeFile(
    path.join(projectDir, 'package.json'),
    `${JSON.stringify({ name: 'database-command-fixture', private: true, type: 'module' }, null, 2)}\n`,
    'utf8',
  )
  await fs.writeFile(
    path.join(projectDir, 'app', 'db.ts'),
    [
      "import * as path from 'node:path'",
      "import { createDatabase, type GetMigrations } from 'remix/data-table'",
      "import { createSqliteDatabaseAdapter } from 'remix/data-table/sqlite'",
      '',
      'enum TableName {',
      "  First = 'first_table',",
      "  Second = 'second_table',",
      '}',
      '',
      'export const db = createDatabase(',
      '  createSqliteDatabaseAdapter({',
      "    filename: path.join(import.meta.dirname, '../database.sqlite'),",
      '  }),',
      ')',
      '',
      'export const getMigrations: GetMigrations = () => [',
      '  {',
      "    id: '20260715120000_create_first',",
      "    name: 'create_first',",
      '    up: `create table ${TableName.First} (id integer primary key)`,',
      '  },',
      '  {',
      "    id: '20260715130000_create_second',",
      "    name: 'create_second',",
      '    up: `create table ${TableName.Second} (id integer primary key)`,',
      '  },',
      ']',
      '',
      'export function seed() {',
      "  console.log('seed stdout')",
      "  console.error('seed stderr')",
      '}',
      '',
    ].join('\n'),
    'utf8',
  )
}
