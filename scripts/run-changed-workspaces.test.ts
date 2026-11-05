import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

const scriptPath = fileURLToPath(new URL('./run-changed-workspaces.ts', import.meta.url))

describe('run-changed-workspaces', () => {
  it('forwards repeated project arguments on a full root run', () => {
    using fixture = createFixture()
    fixture.change('package.json')

    let result = fixture.run(
      'test',
      '--',
      'HEAD',
      'HEAD',
      '--',
      '--project',
      'chromium',
      '--project',
      'firefox',
    )

    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(fixture.readRuns(), [
      { dir: '.', args: ['--project', 'chromium', '--project', 'firefox'] },
    ])
  })

  it('intersects requested workspaces with transitive dependents and forwards test filters', () => {
    using fixture = createFixture()
    fixture.change('packages/shared/index.ts')

    let result = fixture.runWebKit()

    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(fixture.readRuns(), [
      {
        dir: 'demos/bookstore',
        args: ['--project', 'webkit', '--type', 'browser', '--type', 'e2e'],
      },
      {
        dir: 'packages/component',
        args: ['--project', 'webkit', '--type', 'browser', '--type', 'e2e'],
      },
    ])
  })

  it('runs only requested workspaces when shared files require a full run', () => {
    using fixture = createFixture()
    fixture.change('.github/workflows/check-pr.yaml')

    let result = fixture.runWebKit()

    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(
      fixture.readRuns().map((run) => run.dir),
      ['demos/bookstore', 'packages/component'],
    )
  })

  it('skips requested workspaces when only an unrelated workspace changes', () => {
    using fixture = createFixture()
    fixture.change('packages/unrelated/index.ts')

    let result = fixture.runWebKit()

    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(fixture.readRuns(), [])
  })

  it('rejects a misspelled workspace instead of silently dropping its coverage', () => {
    using fixture = createFixture()
    fixture.change('packages/shared/index.ts')

    let result = fixture.run('test', 'HEAD', 'HEAD', '--workspace', 'packages/typo')

    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Unknown workspace: packages\/typo/)
  })
})

function createFixture() {
  let rootDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'remix-changed-workspaces-')))
  let runsPath = path.join(rootDir, 'runs.jsonl')
  let recordPath = path.join(rootDir, 'record.cjs')

  function write(file: string, content: string) {
    let target = path.join(rootDir, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, content)
  }

  write('pnpm-workspace.yaml', "packages:\n  - 'packages/*'\n  - 'demos/*'\n")
  write('.gitignore', 'runs.jsonl\n')
  write(
    'record.cjs',
    `
    let fs = require('node:fs')
    let path = require('node:path')
    fs.appendFileSync(${JSON.stringify(runsPath)}, JSON.stringify({
      dir: path.relative(${JSON.stringify(rootDir)}, process.cwd()).split(path.sep).join('/') || '.',
      args: process.argv.slice(2),
    }) + '\\n')
  `,
  )

  let testScript = `node "${recordPath}"`
  write(
    'package.json',
    JSON.stringify({ name: 'fixture', private: true, scripts: { test: testScript } }),
  )
  for (let workspace of [
    { dir: 'packages/shared', name: 'shared', dependencies: {} },
    { dir: 'packages/component', name: 'component', dependencies: { shared: '*' } },
    { dir: 'demos/bookstore', name: 'bookstore', dependencies: { component: '*' } },
    { dir: 'packages/unrelated', name: 'unrelated', dependencies: {} },
  ]) {
    write(
      `${workspace.dir}/package.json`,
      JSON.stringify({
        name: workspace.name,
        dependencies: workspace.dependencies,
        scripts: { test: testScript },
      }),
    )
    write(`${workspace.dir}/index.ts`, '')
  }
  write('.github/workflows/check-pr.yaml', '')
  cp.execFileSync('git', ['init', '--quiet'], { cwd: rootDir })
  cp.execFileSync('git', ['add', '.'], { cwd: rootDir })
  let tree = cp.execFileSync('git', ['write-tree'], { cwd: rootDir, encoding: 'utf8' }).trim()
  let commit = cp
    .execFileSync(
      'git',
      [
        '-c',
        'user.name=Test',
        '-c',
        'user.email=test@example.com',
        'commit-tree',
        tree,
        '-m',
        'fixture',
      ],
      { cwd: rootDir, encoding: 'utf8' },
    )
    .trim()
  cp.execFileSync('git', ['update-ref', 'HEAD', commit], { cwd: rootDir })

  function run(...args: string[]) {
    return cp.spawnSync(process.execPath, [scriptPath, ...args], {
      cwd: rootDir,
      env: { ...process.env, CI: 'true' },
      encoding: 'utf8',
    })
  }

  return {
    change(file: string) {
      fs.appendFileSync(path.join(rootDir, file), '\n')
    },
    run,
    runWebKit() {
      return run(
        'test',
        'HEAD',
        'HEAD',
        '--workspace',
        'packages/component',
        '--workspace',
        'demos/bookstore',
        '--',
        '--project',
        'webkit',
        '--type',
        'browser',
        '--type',
        'e2e',
      )
    },
    readRuns(): { dir: string; args: string[] }[] {
      if (!fs.existsSync(runsPath)) return []
      return fs
        .readFileSync(runsPath, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
        .sort((a, b) => a.dir.localeCompare(b.dir))
    },
    [Symbol.dispose]() {
      fs.rmSync(rootDir, { recursive: true, force: true })
    },
  }
}
