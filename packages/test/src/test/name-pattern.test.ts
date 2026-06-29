import * as assert from '@remix-run/assert'
import { spawn } from 'node:child_process'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { fileURLToPath } from 'node:url'
import { describe, it } from '../lib/framework.ts'
import { IS_BUN } from '../lib/runtime.ts'

const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const FIXTURE_DIR = path.join(PKG_DIR, '.tmp', 'test-name-pattern')

describe('test name patterns', () => {
  it(
    'filters server, browser, and E2E tests by full name in the same default run',
    { skip: IS_BUN },
    async () => {
      await writeProject(FIXTURE_DIR)

      try {
        let output = await runFixtureCli(FIXTURE_DIR)
        let stdout = stripVTControlCharacters(output.stdout)

        assert.equal(output.exitCode, 0, output.stderr || output.stdout)
        assert.match(stdout, /Found 3 test file\(s\) \(1 server, 1 browser, 1 e2e\)/)
        assert.match(stdout, /✓ runs matching server test/)
        assert.match(stdout, /✓ runs matching browser test/)
        assert.match(stdout, /✓ runs matching E2E test/)
        assert.doesNotMatch(stdout, /does not run non-matching server test/)
        assert.doesNotMatch(stdout, /does not run non-matching browser test/)
        assert.doesNotMatch(stdout, /does not run non-matching E2E test/)
        assert.match(stdout, /ℹ pass 3/)
        assert.equal(output.stderr, '')
      } finally {
        await fsp.rm(FIXTURE_DIR, { recursive: true, force: true })
      }
    },
  )

  it(
    'filters tests by full name after filtering by type',
    { skip: IS_BUN },
    async () => {
      await writeProject(FIXTURE_DIR)

      try {
        let serverOutput = await runFixtureCli(FIXTURE_DIR, ['--type', 'server'])
        let serverStdout = stripVTControlCharacters(serverOutput.stdout)

        assert.equal(serverOutput.exitCode, 0, serverOutput.stderr || serverOutput.stdout)
        assert.match(serverStdout, /Found 1 test file\(s\) \(1 server, 0 browser, 0 e2e\)/)
        assert.match(serverStdout, /✓ runs matching server test/)
        assert.match(serverStdout, /ℹ pass 1/)
        assert.equal(serverOutput.stderr, '')

        let browserOutput = await runFixtureCli(FIXTURE_DIR, ['--type', 'browser'])
        let browserStdout = stripVTControlCharacters(browserOutput.stdout)

        assert.equal(browserOutput.exitCode, 0, browserOutput.stderr || browserOutput.stdout)
        assert.match(browserStdout, /Found 1 test file\(s\) \(0 server, 1 browser, 0 e2e\)/)
        assert.match(browserStdout, /✓ runs matching browser test/)
        assert.match(browserStdout, /ℹ pass 1/)
        assert.equal(browserOutput.stderr, '')

        let e2eOutput = await runFixtureCli(FIXTURE_DIR, ['--type', 'e2e'])
        let e2eStdout = stripVTControlCharacters(e2eOutput.stdout)

        assert.equal(e2eOutput.exitCode, 0, e2eOutput.stderr || e2eOutput.stdout)
        assert.match(e2eStdout, /Found 1 test file\(s\) \(0 server, 0 browser, 1 e2e\)/)
        assert.match(e2eStdout, /✓ runs matching E2E test/)
        assert.match(e2eStdout, /ℹ pass 1/)
        assert.equal(e2eOutput.stderr, '')
      } finally {
        await fsp.rm(FIXTURE_DIR, { recursive: true, force: true })
      }
    },
  )
})

async function writeProject(projectDir: string): Promise<void> {
  await fsp.rm(projectDir, { recursive: true, force: true })
  await fsp.mkdir(projectDir, { recursive: true })
  await fsp.writeFile(
    path.join(projectDir, 'package.json'),
    `${JSON.stringify({ name: 'test-name-pattern-fixture', private: true, type: 'module' }, null, 2)}\n`,
    'utf8',
  )
  await fsp.mkdir(path.join(projectDir, 'node_modules', '@remix-run'), { recursive: true })
  await fsp.symlink(PKG_DIR, path.join(projectDir, 'node_modules', '@remix-run', 'test'))
  await fsp.writeFile(
    path.join(projectDir, 'sample.test.browser.ts'),
    [
      "import { describe, it } from '@remix-run/test'",
      '',
      "describe('browser name pattern', () => {",
      "  it('runs matching browser test', () => {",
      "    document.body.innerHTML = '<h1>Matched</h1>'",
      "    if (document.querySelector('h1')?.textContent !== 'Matched') {",
      "      throw new Error('Browser assertion failed')",
      '    }',
      '  })',
      '',
      "  it('does not run non-matching browser test', () => {",
      "    throw new Error('This browser test should have been filtered out')",
      '  })',
      '})',
      '',
    ].join('\n'),
    'utf8',
  )
  await fsp.writeFile(
    path.join(projectDir, 'sample.test.ts'),
    [
      "import * as assert from 'node:assert/strict'",
      "import { describe, it } from '@remix-run/test'",
      '',
      "describe('server name pattern', () => {",
      "  it('runs matching server test', () => {",
      "    assert.equal('Matched', 'Matched')",
      '  })',
      '',
      "  it('does not run non-matching server test', () => {",
      "    throw new Error('This server test should have been filtered out')",
      '  })',
      '})',
      '',
    ].join('\n'),
    'utf8',
  )
  await fsp.writeFile(
    path.join(projectDir, 'sample.test.e2e.ts'),
    [
      "import * as assert from 'node:assert/strict'",
      "import * as http from 'node:http'",
      "import { describe, it } from '@remix-run/test'",
      '',
      'async function serveHtml(html: string) {',
      '  let server = http.createServer((_request, response) => {',
      "    response.writeHead(200, { 'Content-Type': 'text/html' })",
      '    response.end(html)',
      '  })',
      '  await new Promise<void>((resolve, reject) => {',
      "    server.once('error', reject)",
      "    server.listen(0, '127.0.0.1', () => {",
      "      server.off('error', reject)",
      '      resolve()',
      '    })',
      '  })',
      '  let address = server.address()',
      "  if (!address || typeof address === 'string') throw new Error('Server did not bind')",
      '  return {',
      '    baseUrl: `http://127.0.0.1:${address.port}`,',
      '    close: () => new Promise<void>((resolve, reject) => {',
      '      server.close((error) => error ? reject(error) : resolve())',
      '    }),',
      '  }',
      '}',
      '',
      "describe('e2e name pattern', () => {",
      "  it('runs matching E2E test', async (t) => {",
      "    let page = await t.serve(await serveHtml('<h1>Matched</h1>'))",
      "    await page.goto('/')",
      "    assert.equal(await page.locator('h1').textContent(), 'Matched')",
      '  })',
      '',
      "  it('does not run non-matching E2E test', () => {",
      "    throw new Error('This test should have been filtered out')",
      '  })',
      '})',
      '',
    ].join('\n'),
    'utf8',
  )
}

function runFixtureCli(
  projectDir: string,
  args: string[] = [],
): Promise<{
  exitCode: number
  stdout: string
  stderr: string
}> {
  return new Promise((resolve, reject) => {
    let child = spawn(
      'node',
      [
        path.join(PKG_DIR, 'src', 'cli-entry.ts'),
        '--concurrency',
        '1',
        '--reporter',
        'spec',
        ...args,
        '--test-name-pattern',
        'name pattern runs matching',
      ],
      { cwd: projectDir, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let stdout: Buffer[] = []
    let stderr: Buffer[] = []

    child.stdout?.on('data', (chunk) => stdout.push(chunk))
    child.stderr?.on('data', (chunk) => stderr.push(chunk))
    child.on('error', reject)
    child.on('exit', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout: Buffer.concat(stdout).toString('utf-8'),
        stderr: Buffer.concat(stderr).toString('utf-8'),
      })
    })
  })
}
