import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { execFileSync, spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_PATH = fileURLToPath(new URL('./test-browser.ts', import.meta.url))

function createFixture() {
  let root = fs.mkdtempSync(path.join(os.tmpdir(), 'remix-test-browser-'))
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ private: true }))
  fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n')

  function workspace(name: string, config?: string, script?: string) {
    let dir = path.join(root, 'packages', name)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: name.replaceAll(' ', '-'),
        private: true,
        scripts: script ? { test: script } : {},
      }),
    )
    if (config) fs.writeFileSync(path.join(dir, config), '')
  }

  function run(refs: string[] = []) {
    return spawnSync(process.execPath, [SCRIPT_PATH, ...refs], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, CI: 'true' },
    })
  }

  function git(...args: string[]) {
    return execFileSync('git', ['-C', root, '-c', 'core.hooksPath=/dev/null', ...args], {
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim()
  }

  function commit() {
    git('add', '.')
    git(
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.test',
      'commit',
      '-qm',
      'fixture',
    )
    return git('rev-parse', 'HEAD')
  }

  return {
    root,
    workspace,
    run,
    git,
    commit,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  }
}

describe('test:browser', () => {
  it('runs browser workspaces with both browser and e2e tests, excluding native suites', () => {
    let fixture = createFixture()
    try {
      fs.writeFileSync(
        path.join(fixture.root, 'record.cjs'),
        "require('node:fs').writeFileSync('args.json', JSON.stringify(process.argv.slice(2)))",
      )
      fixture.workspace('browser-ts', 'playwright.config.ts', 'node ../../record.cjs')
      fixture.workspace('browser-js', 'playwright.config.js', 'node ../../record.cjs')
      fixture.workspace('native', undefined, 'node -e "process.exit(2)"')
      fixture.workspace('no-test-script', 'playwright.config.ts')

      let result = fixture.run()
      assert.equal(result.status, 0, result.stdout + result.stderr)
      for (let name of ['browser-ts', 'browser-js']) {
        assert.deepEqual(
          JSON.parse(
            fs.readFileSync(path.join(fixture.root, 'packages', name, 'args.json'), 'utf8'),
          ),
          ['--type', 'browser', '--type', 'e2e'],
        )
      }
    } finally {
      fixture.cleanup()
    }
  })

  it('fails when a browser suite fails or no browser suites exist', () => {
    let fixture = createFixture()
    try {
      assert.notEqual(fixture.run().status, 0)
      fixture.workspace('failing-browser', 'playwright.config.ts', 'node -e "process.exit(2)"')
      assert.notEqual(fixture.run().status, 0)
    } finally {
      fixture.cleanup()
    }
  })

  it('skips unchanged browser workspaces and unrelated changes when refs are provided', () => {
    let fixture = createFixture()
    try {
      fixture.git('init', '-q')
      fixture.workspace('browser', 'playwright.config.ts', 'node -e "process.exit(2)"')
      fixture.workspace('native', undefined, 'node -e "process.exit(2)"')
      let base = fixture.commit()
      assert.equal(fixture.run([base, base]).status, 0)

      fs.writeFileSync(path.join(fixture.root, 'packages/native/changed.ts'), '')
      fs.writeFileSync(path.join(fixture.root, 'playwright.config.ts'), '')
      let head = fixture.commit()
      let result = fixture.run([base, head])
      assert.equal(result.status, 0, result.stdout + result.stderr)
      assert.ok(result.stdout.includes('No browser workspace changes'))
      assert.notEqual(fixture.run(['missing-ref', head]).status, 0)
      assert.notEqual(fixture.run([base]).status, 0)
    } finally {
      fixture.cleanup()
    }
  })

  it('runs the entire browser suite when a configured workspace changes or loses its config', () => {
    let fixture = createFixture()
    try {
      fixture.git('init', '-q')
      fixture.workspace('changed browser', 'playwright.config.js', 'node -e "process.exit(0)"')
      fixture.workspace(
        'unchanged-browser',
        'playwright.config.ts',
        'node -e "console.log(\'unchanged browser ran\'); process.exit(2)"',
      )
      let base = fixture.commit()
      fs.writeFileSync(path.join(fixture.root, 'packages/changed browser/changed.ts'), '')
      let head = fixture.commit()
      let result = fixture.run([base, head])
      assert.notEqual(result.status, 0)
      assert.ok(result.stdout.includes('unchanged browser ran'), result.stdout + result.stderr)

      fs.unlinkSync(path.join(fixture.root, 'packages/changed browser/playwright.config.js'))
      head = fixture.commit()
      result = fixture.run([base, head])
      assert.notEqual(result.status, 0)
      assert.ok(result.stdout.includes('unchanged browser ran'), result.stdout + result.stderr)
    } finally {
      fixture.cleanup()
    }
  })
})
