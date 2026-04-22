import * as assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as process from 'node:process'
import { dirname, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { run } from './cli.ts'

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = resolve(PACKAGE_DIR, '../..')
const CLI_FIXTURES_DIR = path.join(REPO_ROOT, 'packages', 'cli', 'test', 'fixtures')
const REMIX_GITHUB_TREE_URL =
  'https://api.github.com/repos/remix-run/remix/git/trees/main?recursive=1'

describe('remix CLI wrapper', () => {
  it('runs directly from the generated source entrypoint', () => {
    let result = spawnSync(process.execPath, ['./src/cli.ts', '--help'], {
      cwd: PACKAGE_DIR,
      encoding: 'utf8',
    })

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Usage:\s+remix <command> \[options\]/)
  })

  it('smoke tests every top-level command through the package wrapper', async () => {
    let packageVersion = await readPackageVersion()
    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-smoke-'))

    try {
      let help = await captureOutput(() => run(['--help']))
      assert.equal(help.exitCode, 0)
      assert.match(help.stdout, /Commands:/)
      assert.match(help.stdout, /new <name>\s+Create a new Remix project/)

      let commandHelp = await captureOutput(() => run(['help', 'routes']))
      assert.equal(commandHelp.exitCode, 0)
      assert.match(commandHelp.stdout, /Usage:\s+remix routes/)

      let version = await captureOutput(() => run(['version']))
      assert.equal(version.exitCode, 0)
      assert.equal(version.stdout, `${packageVersion}\n`)

      let completion = await captureOutput(() => run(['completion', 'bash']))
      assert.equal(completion.exitCode, 0)
      assert.match(completion.stdout, /###-begin-remix-completion-###/)

      let appDir = path.join(tmpDir, 'my-app')
      let newApp = await captureOutput(() => run(['new', appDir, '--app-name', 'Smoke App']))
      assert.equal(newApp.exitCode, 0, newApp.stderr)
      await assertPathExists(path.join(appDir, 'AGENTS.md'))
      await assertPathExists(path.join(appDir, 'app', 'routes.ts'))

      let doctor = await withCwd(getFixturePath('doctor-clean'), () =>
        captureOutput(() => run(['doctor', '--json'])),
      )
      assert.equal(doctor.exitCode, 0, doctor.stderr)
      assert.equal(doctor.stderr, '')
      let doctorReport = JSON.parse(doctor.stdout) as { findings: unknown[] }
      assert.equal(doctorReport.findings.length, 0)

      let routes = await withCwd(getFixturePath('routes-tree'), () =>
        captureOutput(() => run(['routes', '--json'])),
      )
      assert.equal(routes.exitCode, 0, routes.stderr)
      assert.equal(routes.stderr, '')
      let routesReport = JSON.parse(routes.stdout) as { tree: Array<{ name: string }> }
      assert.ok(routesReport.tree.some((route) => route.name === 'home'))

      let skillsProjectDir = path.join(tmpDir, 'skills-project')
      await fs.mkdir(skillsProjectDir)
      await fs.writeFile(
        path.join(skillsProjectDir, 'package.json'),
        `${JSON.stringify({ name: 'skills-project', private: true }, null, 2)}\n`,
        'utf8',
      )

      let skills = await withCwd(skillsProjectDir, () =>
        withFetchMock(createSkillsMetadataFetchMock(), () =>
          captureOutput(() => run(['skills', 'list', '--json'])),
        ),
      )
      assert.equal(skills.exitCode, 0, skills.stderr)
      assert.equal(skills.stderr, '')
      let skillsReport = JSON.parse(skills.stdout) as {
        entries: Array<{ name: string; state: string }>
      }
      assert.deepEqual(skillsReport.entries, [{ name: 'remix-ui', state: 'missing' }])
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })
})

async function readPackageVersion(): Promise<string> {
  let packageJson = JSON.parse(await fs.readFile(path.join(PACKAGE_DIR, 'package.json'), 'utf8'))
  let version =
    typeof packageJson === 'object' && packageJson != null
      ? Reflect.get(packageJson, 'version')
      : null

  assert.equal(typeof version, 'string')
  return version
}

function getFixturePath(name: string): string {
  return path.join(CLI_FIXTURES_DIR, name)
}

async function captureOutput(
  callback: () => Promise<number>,
): Promise<{ exitCode: number; stderr: string; stdout: string }> {
  let originalStdoutWrite = process.stdout.write
  let originalStderrWrite = process.stderr.write
  let stdout = ''
  let stderr = ''

  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
    return true
  }) as typeof process.stdout.write

  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
    return true
  }) as typeof process.stderr.write

  try {
    let exitCode = await callback()
    return { exitCode, stderr, stdout }
  } finally {
    process.stdout.write = originalStdoutWrite
    process.stderr.write = originalStderrWrite
  }
}

async function withCwd<result>(cwd: string, callback: () => Promise<result>): Promise<result> {
  let originalCwd = process.cwd()
  process.chdir(cwd)

  try {
    return await callback()
  } finally {
    process.chdir(originalCwd)
  }
}

async function withFetchMock<result>(
  fetchMock: typeof fetch,
  callback: () => Promise<result>,
): Promise<result> {
  let originalFetch = globalThis.fetch
  globalThis.fetch = fetchMock

  try {
    return await callback()
  } finally {
    globalThis.fetch = originalFetch
  }
}

function createSkillsMetadataFetchMock(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

    if (url === REMIX_GITHUB_TREE_URL) {
      return new Response(
        JSON.stringify({
          tree: [
            {
              path: 'skills/remix-ui/SKILL.md',
              sha: '0000000000000000000000000000000000000000',
              type: 'blob',
            },
          ],
          truncated: false,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    return new Response('Not found', { status: 404, statusText: 'Not Found' })
  }) as typeof fetch
}

async function assertPathExists(filePath: string): Promise<void> {
  await fs.access(filePath)
}
