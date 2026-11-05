import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_PATH = fileURLToPath(new URL('./test-browser.sh', import.meta.url))

function createFixture() {
  let root = fs.mkdtempSync(path.join(os.tmpdir(), 'remix-test-browser-'))
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ private: true, scripts: { test: 'node -e "process.exit(2)"' } }),
  )
  fs.writeFileSync(path.join(root, 'playwright.config.ts'), '')
  fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n')

  function workspace(name: string, config?: string, script?: string) {
    let dir = path.join(root, 'packages', name)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name, private: true, scripts: script ? { test: script } : {} }),
    )
    if (config) fs.writeFileSync(path.join(dir, config), '')
  }

  function run() {
    return spawnSync('bash', [SCRIPT_PATH], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, CI: 'true' },
    })
  }

  return { root, workspace, run, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) }
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
})
