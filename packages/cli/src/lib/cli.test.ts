import * as assert from '@remix-run/assert'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as process from 'node:process'
import { describe, it } from '@remix-run/test'

import { getFixturePath } from '../../test/fixtures.ts'
import { run as runCli } from '../index.ts'
import { getTestCommandHelpText } from './commands/test.ts'
import type { CliRuntimeContext } from './runtime-context.ts'

const REMIX_GITHUB_TREE_URL =
  'https://api.github.com/repos/remix-run/remix/git/trees/main?recursive=1'

let testCwd: string | undefined

function run(argv: string[], context: CliRuntimeContext = {}): Promise<number> {
  return runCli(argv, { cwd: testCwd, ...context })
}

const ROOT_HELP_TEXT = [
  'Usage:',
  '  remix <command> [options]',
  '',
  'Commands:',
  '  completion      Print shell completion scripts for Remix',
  '  help [command]  Show help for Remix commands',
  '  new <name>      Create a new Remix project',
  '  doctor          Check project health for the current project',
  '  routes          Show the route tree for the current project',
  '  skills          Manage Remix skills for the current project',
  '  test [glob]     Run tests for the current project',
  '  version         Show the current Remix version',
  '',
  'Options:',
  '  -h, --help     Show help',
  '  --no-color     Disable ANSI color output',
  '  -v, --version  Show version',
  '',
  'Examples:',
  '  remix completion bash',
  '  remix help',
  '  remix help completion',
  '  remix help doctor',
  '  remix help skills install',
  '  remix doctor',
  '  remix new my-remix-app',
  '  remix new my-remix-app --app-name "My Remix App"',
  '  remix routes',
  '  remix skills install',
  '  remix test',
  '  remix version',
  '',
].join('\n')

const COMPLETION_COMMAND_HELP_TEXT = [
  'Usage:',
  '  remix completion <bash|zsh>',
  '',
  'Print a shell completion script for Remix.',
  '',
  'Examples:',
  '  remix completion bash >> ~/.bashrc',
  '  remix completion zsh >> ~/.zshrc',
  '',
].join('\n')

const DOCTOR_COMMAND_HELP_TEXT = [
  'Usage:',
  '  remix doctor [--json] [--strict] [--fix] [--no-color]',
  '',
  'Check project environment and Remix app conventions for the current project.',
  '',
  'Options:',
  '  --json    Print doctor findings as JSON',
  '  --strict  Exit with status 1 when warning-level findings are present',
  '  --fix     Apply low-risk project and controller fixes',
  '',
  'Examples:',
  '  remix doctor',
  '  remix doctor --json',
  '  remix doctor --strict',
  '  remix doctor --fix',
  '',
].join('\n')

const HELP_COMMAND_HELP_TEXT = [
  'Usage:',
  '  remix help [command]',
  '',
  'Show help for Remix commands.',
  '',
  'Examples:',
  '  remix help',
  '  remix help completion',
  '  remix help doctor',
  '  remix help new',
  '  remix help routes',
  '  remix help skills install',
  '  remix help test',
  '  remix help version',
  '',
].join('\n')

const NEW_COMMAND_HELP_TEXT = [
  'Usage:',
  '  remix new <target-dir> [--app-name <name>] [--force]',
  '',
  'Create a new Remix project in the target directory.',
  '',
  'Examples:',
  '  remix new ./my-remix-app',
  '  remix new ./my-remix-app --app-name "My Remix App"',
  '  remix new ./my-remix-app --force',
  '',
].join('\n')

const ROUTES_COMMAND_HELP_TEXT = [
  'Usage:',
  '  remix routes [--json | --table] [--no-headers] [--verbose] [--no-color]',
  '',
  'Show the Remix route tree for the current app.',
  '',
  'Options:',
  '  --json        Print the normalized route tree as JSON',
  '  --table       Print routes as a flat table',
  '  --no-headers  Omit the table header row when using --table',
  '  --verbose     Show full owner paths in tree or table output',
  '',
  'Examples:',
  '  remix routes',
  '  remix routes --table',
  '  remix routes --table --no-headers',
  '  remix routes --verbose',
  '  remix routes --json',
  '',
].join('\n')

const SKILLS_COMMAND_HELP_TEXT = [
  'Usage:',
  '  remix skills <command>',
  '',
  'Manage Remix skills for the current project.',
  '',
  'Commands:',
  '  install [--dir <path>]        Install Remix skills into a local directory',
  '  list [--dir <path>] [--json]  List Remix skills and local status',
  '',
  'Examples:',
  '  remix skills install',
  '  remix skills install --dir custom/skills',
  '  remix skills list --dir custom/skills',
  '  remix skills list --json',
  '',
].join('\n')

const SKILLS_INSTALL_COMMAND_HELP_TEXT = [
  'Usage:',
  '  remix skills install [--dir <path>]',
  '',
  'Install or refresh Remix skills in .agents/skills for the current project.',
  '',
  'Options:',
  '  --dir <path>  Install skills into a custom directory relative to the project root',
  '',
  'Examples:',
  '  remix skills install',
  '  remix skills install --dir custom/skills',
  '',
].join('\n')

const SKILLS_LIST_COMMAND_HELP_TEXT = [
  'Usage:',
  '  remix skills list [--dir <path>] [--json]',
  '',
  'List Remix skills and show whether each one is installed, outdated, or missing locally.',
  '',
  'Options:',
  '  --dir <path>  Read local skills from a custom directory relative to the project root',
  '  --json        Print skill state as JSON',
  '',
  'Examples:',
  '  remix skills list',
  '  remix skills list --dir custom/skills',
  '  remix skills list --json',
  '',
].join('\n')

const TEST_COMMAND_HELP_TEXT = getTestCommandHelpText()

const VERSION_COMMAND_HELP_TEXT = [
  'Usage:',
  '  remix version',
  '',
  'Show the current Remix version.',
  '',
  'Examples:',
  '  remix version',
  '  remix --version',
  '',
].join('\n')

const UNKNOWN_COMMAND_ERROR_TEXT = [
  'Error [RMX_UNKNOWN_COMMAND] Unknown command',
  'Unknown command: unknown',
  '',
  'Try:',
  '  Run `remix help` to see available commands.',
  '',
  ROOT_HELP_TEXT,
].join('\n')

const UNKNOWN_HELP_TOPIC_ERROR_TEXT = [
  'Error [RMX_UNKNOWN_HELP_TOPIC] Unknown help topic',
  'Unknown help topic: unknown',
  '',
  'Try:',
  '  Run `remix help` to see available commands and help topics.',
  '',
  ROOT_HELP_TEXT,
].join('\n')

describe('run', () => {
  it('prints root help', async () => {
    let result = await captureOutput(() => run(['--help']))

    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout, ROOT_HELP_TEXT)
    assert.equal(result.stderr, '')
  })

  it('prints root help from the help command', async () => {
    let result = await captureOutput(() => run(['help']))

    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout, ROOT_HELP_TEXT)
    assert.equal(result.stderr, '')
  })

  it('prints help command help', async () => {
    let result = await captureOutput(() => run(['help', '--help']))

    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout, HELP_COMMAND_HELP_TEXT)
    assert.equal(result.stderr, '')
  })

  it('prints the configured version', async () => {
    let result = await captureOutput(() => run(['--version'], { remixVersion: '9.9.9' }))

    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout, '9.9.9\n')
    assert.equal(result.stderr, '')
  })

  it('prints the configured version from the version command', async () => {
    let result = await captureOutput(() => run(['version'], { remixVersion: '9.9.9' }))

    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout, '9.9.9\n')
    assert.equal(result.stderr, '')
  })

  it('smoke tests every top-level command', async () => {
    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-smoke-'))

    try {
      let rootHelp = await captureOutput(() => run(['--help']))
      assert.equal(rootHelp.exitCode, 0)
      assert.match(rootHelp.stdout, /Commands:/)
      assert.match(rootHelp.stdout, /new <name>\s+Create a new Remix project/)

      let commandHelp = await captureOutput(() => run(['help', 'routes']))
      assert.equal(commandHelp.exitCode, 0)
      assert.match(commandHelp.stdout, /Usage:\s+remix routes/)

      let version = await captureOutput(() => run(['version'], { remixVersion: '9.9.9' }))
      assert.equal(version.exitCode, 0)
      assert.equal(version.stdout, '9.9.9\n')

      let completion = await captureOutput(() => run(['completion', 'bash']))
      assert.equal(completion.exitCode, 0)
      assert.match(completion.stdout, /###-begin-remix-completion-###/)

      let appDir = path.join(tmpDir, 'my-app')
      let newApp = await captureOutput(() =>
        run(['new', appDir, '--app-name', 'Smoke App'], { remixVersion: '9.9.9' }),
      )
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

      let test = await captureOutput(() => run(['test', '--help']))
      assert.equal(test.exitCode, 0)
      assert.equal(test.stdout, TEST_COMMAND_HELP_TEXT)
      assert.equal(test.stderr, '')
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('prints new command help', async () => {
    let result = await captureOutput(() => run(['new', '--help']))

    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout, NEW_COMMAND_HELP_TEXT)
    assert.equal(result.stderr, '')
  })

  it('prints new command help when no additional arguments are provided', async () => {
    let result = await captureOutput(() => run(['new']))

    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout, NEW_COMMAND_HELP_TEXT)
    assert.equal(result.stderr, '')
  })

  it('prints command help from the help command', async () => {
    let doctorHelp = await captureOutput(() => run(['help', 'doctor']))
    let completionHelp = await captureOutput(() => run(['help', 'completion']))
    let newHelp = await captureOutput(() => run(['help', 'new']))
    let helpHelp = await captureOutput(() => run(['help', 'help']))
    let routesHelp = await captureOutput(() => run(['help', 'routes']))
    let skillsHelp = await captureOutput(() => run(['help', 'skills']))
    let skillsInstallHelp = await captureOutput(() => run(['help', 'skills', 'install']))
    let skillsListHelp = await captureOutput(() => run(['help', 'skills', 'list']))
    let testHelp = await captureOutput(() => run(['help', 'test']))
    let versionHelp = await captureOutput(() => run(['help', 'version']))

    assert.equal(doctorHelp.exitCode, 0)
    assert.equal(doctorHelp.stdout, DOCTOR_COMMAND_HELP_TEXT)
    assert.equal(doctorHelp.stderr, '')
    assert.equal(completionHelp.exitCode, 0)
    assert.equal(completionHelp.stdout, COMPLETION_COMMAND_HELP_TEXT)
    assert.equal(completionHelp.stderr, '')
    assert.equal(newHelp.exitCode, 0)
    assert.equal(newHelp.stdout, NEW_COMMAND_HELP_TEXT)
    assert.equal(newHelp.stderr, '')
    assert.equal(helpHelp.exitCode, 0)
    assert.equal(helpHelp.stdout, HELP_COMMAND_HELP_TEXT)
    assert.equal(helpHelp.stderr, '')
    assert.equal(routesHelp.exitCode, 0)
    assert.equal(routesHelp.stdout, ROUTES_COMMAND_HELP_TEXT)
    assert.equal(routesHelp.stderr, '')
    assert.equal(skillsHelp.exitCode, 0)
    assert.equal(skillsHelp.stdout, SKILLS_COMMAND_HELP_TEXT)
    assert.equal(skillsHelp.stderr, '')
    assert.equal(skillsInstallHelp.exitCode, 0)
    assert.equal(skillsInstallHelp.stdout, SKILLS_INSTALL_COMMAND_HELP_TEXT)
    assert.equal(skillsInstallHelp.stderr, '')
    assert.equal(skillsListHelp.exitCode, 0)
    assert.equal(skillsListHelp.stdout, SKILLS_LIST_COMMAND_HELP_TEXT)
    assert.equal(skillsListHelp.stderr, '')
    assert.equal(testHelp.exitCode, 0)
    assert.equal(testHelp.stdout, TEST_COMMAND_HELP_TEXT)
    assert.equal(testHelp.stderr, '')
    assert.equal(versionHelp.exitCode, 0)
    assert.equal(versionHelp.stdout, VERSION_COMMAND_HELP_TEXT)
    assert.equal(versionHelp.stderr, '')
  })

  it('prints routes command help', async () => {
    let result = await captureOutput(() => run(['routes', '--help']))

    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout, ROUTES_COMMAND_HELP_TEXT)
    assert.equal(result.stderr, '')
  })

  it('prints version command help', async () => {
    let result = await captureOutput(() => run(['version', '--help']))

    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout, VERSION_COMMAND_HELP_TEXT)
    assert.equal(result.stderr, '')
  })

  it('accepts the global no-color flag', async () => {
    let result = await captureOutput(() =>
      run(['--no-color', 'version'], { remixVersion: '9.9.9' }),
    )

    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout, '9.9.9\n')
    assert.equal(result.stderr, '')
  })

  it('ignores a leading double-dash separator', async () => {
    let result = await captureOutput(() => run(['--', '--help']))

    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout, ROOT_HELP_TEXT)
    assert.equal(result.stderr, '')
  })

  it('fails for unknown commands', async () => {
    let result = await captureOutput(() => run(['unknown']))

    assert.equal(result.exitCode, 1)
    assert.equal(result.stdout, '')
    assert.equal(result.stderr, UNKNOWN_COMMAND_ERROR_TEXT)
  })

  it('fails for unknown help topics', async () => {
    let result = await captureOutput(() => run(['help', 'unknown']))

    assert.equal(result.exitCode, 1)
    assert.equal(result.stdout, '')
    assert.equal(result.stderr, UNKNOWN_HELP_TOPIC_ERROR_TEXT)
  })

  it('creates the expected scaffold', async () => {
    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-'))
    try {
      let appDir = path.join(tmpDir, 'my-app')
      let result = await captureOutput(() => run(['new', appDir, '--app-name', 'My App']))

      assert.equal(result.exitCode, 0)
      assert.match(result.stderr, /• Prepare target directory\.\.\./)
      assert.match(result.stderr, /✓ Prepare target directory/)
      assert.match(result.stderr, /• Generate scaffold files\.\.\./)
      assert.match(result.stderr, /✓ Generate scaffold files/)
      assert.match(result.stderr, /• Finalize package\.json\.\.\./)
      assert.match(result.stderr, /✓ Finalize package\.json/)
      assert.match(result.stderr, /✓ Finalize package\.json\n\n$/)
      assert.match(
        result.stdout,
        new RegExp(`Created My App at ${escapeRegExp(path.relative(process.cwd(), appDir))}`),
      )

      let packageJson = JSON.parse(
        await fs.readFile(path.join(appDir, 'package.json'), 'utf8'),
      ) as {
        dependencies: Record<string, string>
        devDependencies: Record<string, string>
        engines: Record<string, string>
        name: string
      }
      let agentsGuide = await fs.readFile(path.join(appDir, 'AGENTS.md'), 'utf8')
      let readme = await fs.readFile(path.join(appDir, 'README.md'), 'utf8')

      assert.equal(packageJson.name, 'my-app')
      assert.equal(packageJson.dependencies.remix, 'latest')
      assert.equal(packageJson.dependencies.tsx, 'latest')
      assert.equal(packageJson.devDependencies['@types/node'], 'latest')
      assert.equal(packageJson.devDependencies.typescript, 'latest')
      assert.equal(packageJson.engines.node, '>=24.3.0')
      assert.match(agentsGuide, /^# My App Agent Guide/m)
      assert.match(agentsGuide, /This starter intentionally begins small/)
      assert.match(
        agentsGuide,
        /Keep simple pages in flat files like `app\/controllers\/home\.tsx`/,
      )
      assert.match(readme, /^# My App/m)
      await assertPathExists(path.join(appDir, 'app', 'routes.ts'))
      await assertPathExists(path.join(appDir, 'app', 'controllers', 'home.tsx'))
      await assertPathExists(path.join(appDir, 'app', 'controllers', 'auth.tsx'))
      await assertPathMissing(path.join(appDir, 'app', 'controllers', 'about.tsx'))
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('rejects non-empty target directories without --force', async () => {
    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-'))
    try {
      let appDir = path.join(tmpDir, 'my-app')
      await fs.mkdir(appDir, { recursive: true })
      await fs.writeFile(path.join(appDir, 'keep.txt'), 'keep', 'utf8')

      let result = await captureOutput(() => run(['new', appDir]))

      assert.equal(result.exitCode, 1)
      assert.match(
        result.stderr,
        new RegExp(`Target directory is not empty: ${escapeRegExp(appDir)}`),
      )
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('marks scaffold generation as failed before rendering the error', async () => {
    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-'))

    try {
      let appDir = path.join(tmpDir, 'my-app')
      await fs.mkdir(appDir, { recursive: true })
      await fs.writeFile(path.join(appDir, 'app'), 'blocking file', 'utf8')

      let result = await captureOutput(() => run(['new', appDir, '--force']))

      assert.equal(result.exitCode, 1)
      assert.equal(result.stdout, '')
      assert.match(result.stderr, /• Prepare target directory\.\.\./)
      assert.match(result.stderr, /✓ Prepare target directory/)
      assert.match(result.stderr, /• Generate scaffold files\.\.\./)
      assert.match(result.stderr, /✗ Generate scaffold files/)
      assert.match(result.stderr, /✗ Generate scaffold files\n\n/)
      assert.match(result.stderr, /Target path is not a directory|EEXIST|ENOTDIR/)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('uses the override version when remix version is omitted', async () => {
    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-'))
    try {
      let appDir = path.join(tmpDir, 'my-app')
      let result = await withEnv('REMIX_VERSION', '4.5.6', () =>
        captureOutput(() => run(['new', appDir], { remixVersion: '9.9.9' })),
      )

      assert.equal(result.exitCode, 0)

      let packageJson = JSON.parse(
        await fs.readFile(path.join(appDir, 'package.json'), 'utf8'),
      ) as {
        dependencies: Record<string, string>
      }

      assert.equal(packageJson.dependencies.remix, '4.5.6')
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('uses a caret range of the runtime Remix version as the default scaffold version', async () => {
    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-'))
    try {
      let appDir = path.join(tmpDir, 'my-app')
      let result = await captureOutput(() => run(['new', appDir], { remixVersion: '4.5.6' }))

      assert.equal(result.exitCode, 0)

      let packageJson = JSON.parse(
        await fs.readFile(path.join(appDir, 'package.json'), 'utf8'),
      ) as {
        dependencies: Record<string, string>
      }

      assert.equal(packageJson.dependencies.remix, '^4.5.6')
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('does not let REMIX_VERSION override the reported Remix version', async () => {
    let result = await withEnv('REMIX_VERSION', '4.5.6', () =>
      captureOutput(() => run(['version'], { remixVersion: '9.9.9' })),
    )

    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout, '9.9.9\n')
    assert.equal(result.stderr, '')
  })

  it('rejects the removed remix version flag', async () => {
    let result = await captureOutput(() => run(['new', 'my-app', '--remix-version', '1.2.3']))

    assert.equal(result.exitCode, 1)
    assert.match(result.stderr, /Unknown argument: --remix-version/)
  })
})

async function captureOutput(
  callback: () => Promise<number>,
): Promise<{ exitCode: number; stderr: string; stdout: string }> {
  let stderr = ''
  let stdout = ''
  let originalStdoutWrite = process.stdout.write
  let originalStderrWrite = process.stderr.write

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

async function withEnv<T>(name: string, value: string, callback: () => Promise<T>): Promise<T> {
  let previousValue = process.env[name]
  process.env[name] = value

  try {
    return await callback()
  } finally {
    if (previousValue == null) {
      delete process.env[name]
    } else {
      process.env[name] = previousValue
    }
  }
}

async function withCwd<T>(cwd: string, callback: () => Promise<T>): Promise<T> {
  let previousCwd = testCwd
  testCwd = cwd

  try {
    return await callback()
  } finally {
    testCwd = previousCwd
  }
}

async function withFetchMock<T>(fetchMock: typeof fetch, callback: () => Promise<T>): Promise<T> {
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
    let url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

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

async function assertPathMissing(filePath: string): Promise<void> {
  await assert.rejects(fs.access(filePath), (error: unknown) => {
    let nodeError = error as NodeJS.ErrnoException
    return nodeError.code === 'ENOENT'
  })
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&')
}
