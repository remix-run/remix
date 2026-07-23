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
