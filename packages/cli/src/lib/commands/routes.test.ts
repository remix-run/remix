import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as process from 'node:process'
import { fileURLToPath } from 'node:url'
import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { runRemix } from '../../index.ts'
import { getFixturePath } from '../../../test/fixtures.ts'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..')

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

describe('routes command', () => {
  it('prints routes command help', async () => {
    let result = await runRoutesCommand(['--help'], ROOT_DIR)

    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout, ROUTES_COMMAND_HELP_TEXT)
    assert.equal(result.stderr, '')
  })

  it('prints a compact tree for a basic fixture app', async () => {
    let result = await runRoutesCommand([], getFixturePath('routes-basic'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /home\s+ANY\s+\/\s+-> home\.tsx/)
    assert.match(result.stdout, /auth\s+ANY\s+\/auth\s+-> auth\.tsx/)
    assert.equal(result.stderr, '')
  })

  it('does not print color when output is not a tty', async () => {
    let result = await runRoutesCommand([], getFixturePath('routes-basic'))

    assert.equal(result.status, 0, result.stderr)
    assert.doesNotMatch(result.stdout, /\u001B\[/)
  })

  it('works from a nested directory inside an app', async () => {
    let nestedDir = path.join(getFixturePath('routes-tree'), 'app', 'controllers', 'admin')
    let result = await runRoutesCommand([], nestedDir)

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /auth -> auth\/controller\.tsx/)
    assert.match(result.stdout, /login -> auth\/login\/controller\.tsx/)
    assert.match(result.stdout, /action\s+POST\s+\/login(?!\s+->)/)
    assert.match(result.stdout, /orders -> account\/orders\/controller\.tsx/)
    assert.equal(result.stderr, '')
  })

  it('prints a verbose tree with full owner paths on every route', async () => {
    let result = await runRoutesCommand(['--verbose'], getFixturePath('routes-tree'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /auth -> app\/controllers\/auth\/controller\.tsx/)
    assert.match(result.stdout, /login -> app\/controllers\/auth\/login\/controller\.tsx/)
    assert.match(
      result.stdout,
      /action\s+POST\s+\/login -> app\/controllers\/auth\/login\/controller\.tsx/,
    )
    assert.match(
      result.stdout,
      /logout\s+POST\s+\/logout -> app\/controllers\/auth\/controller\.tsx/,
    )
    assert.equal(result.stderr, '')
  })

  it('prints a flat table of routes', async () => {
    let result = await runRoutesCommand(['--table'], getFixturePath('routes-tree'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Route\s+Method\s+Path\s+Owner/)
    assert.match(result.stdout, /home\s+ANY\s+\/\s+home\.tsx/)
    assert.match(
      result.stdout,
      /auth\.login\.action\s+POST\s+\/login\s+auth\/login\/controller\.tsx/,
    )
    assert.match(
      result.stdout,
      /admin\.users\.destroy\s+DELETE\s+\/admin\/users\/:userId\s+admin\/users\/controller\.tsx/,
    )
    assert.equal(result.stderr, '')
  })

  it('omits the table header row with --no-headers', async () => {
    let result = await runRoutesCommand(['--table', '--no-headers'], getFixturePath('routes-tree'))

    assert.equal(result.status, 0, result.stderr)
    assert.doesNotMatch(result.stdout, /Route\s+Method\s+Path\s+Owner/)
    assert.match(result.stdout, /home\s+ANY\s+\/\s+home\.tsx/)
    assert.match(
      result.stdout,
      /auth\.login\.action\s+POST\s+\/login\s+auth\/login\/controller\.tsx/,
    )
    assert.equal(result.stderr, '')
  })

  it('accepts the global no-color flag', async () => {
    let result = await runRoutesCommand(['--no-color'], getFixturePath('routes-missing'))

    assert.equal(result.status, 0, result.stderr)
    assert.doesNotMatch(result.stdout, /\u001B\[/)
  })

  it('resolves owner files with js, jsx, and ts extensions', async () => {
    let result = await runRoutesCommand([], getFixturePath('doctor-clean'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /home\s+ANY\s+\/\s+-> home\.js/)
    assert.match(result.stdout, /about\s+ANY\s+\/about\s+-> about\.jsx/)
    assert.match(result.stdout, /contact -> contact\/controller\.ts/)
    assert.equal(result.stderr, '')
  })

  it('maps camelCase route keys to kebab-case owner paths', async () => {
    let result = await runRoutesCommand([], getFixturePath('doctor-camel-case-keys'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /userSettings\s+ANY\s+\/user-settings\s+-> user-settings\.tsx/)
    assert.match(result.stdout, /forgotPassword -> auth\/forgot-password\/controller\.tsx/)
    assert.match(result.stdout, /resetPassword -> auth\/reset-password\/controller\.tsx/)
    assert.equal(result.stderr, '')
  })

  it('prints normalized JSON with owner metadata', async () => {
    let fixtureDir = getFixturePath('routes-tree')
    let result = await runRoutesCommand(['--json'], fixtureDir)

    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stderr, '')

    let payload = JSON.parse(result.stdout) as {
      appRoot: string
      routesFile: string
      tree: RouteTreeNode[]
    }

    assert.equal(payload.appRoot, fixtureDir)
    assert.equal(payload.routesFile, path.join(fixtureDir, 'app', 'routes.ts'))

    let home = findRouteNode(payload.tree, 'home')
    let account = findRouteNode(payload.tree, 'account')
    let authLoginAction = findRouteNode(payload.tree, 'auth.login.action')
    let adminUsersDestroy = findRouteNode(payload.tree, 'admin.users.destroy')

    assert.ok(home)
    assert.equal(home.kind, 'route')
    assert.equal(home.method, 'ANY')
    assert.equal(home.pattern, '/')
    assert.deepEqual(home.owner, {
      exists: true,
      kind: 'action',
      path: 'app/controllers/home.tsx',
    })

    assert.ok(account)
    assert.equal(account.kind, 'group')
    assert.deepEqual(account.owner, {
      exists: true,
      kind: 'controller',
      path: 'app/controllers/account/controller.tsx',
    })

    assert.ok(authLoginAction)
    assert.equal(authLoginAction.kind, 'route')
    assert.equal(authLoginAction.method, 'POST')
    assert.equal(authLoginAction.pattern, '/login')
    assert.deepEqual(authLoginAction.owner, {
      exists: true,
      kind: 'controller',
      path: 'app/controllers/auth/login/controller.tsx',
    })

    assert.ok(adminUsersDestroy)
    assert.equal(adminUsersDestroy.kind, 'route')
    assert.equal(adminUsersDestroy.method, 'DELETE')
    assert.equal(adminUsersDestroy.pattern, '/admin/users/:userId')
    assert.deepEqual(adminUsersDestroy.owner, {
      exists: true,
      kind: 'controller',
      path: 'app/controllers/admin/users/controller.tsx',
    })
  })

  it('annotates missing owners without failing the command', async () => {
    let result = await runRoutesCommand([], getFixturePath('routes-missing'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /home\s+ANY\s+\/\s+-> home\.tsx \[missing\]/)
    assert.match(result.stdout, /auth -> auth\/controller\.tsx \[missing\]/)
    assert.match(result.stdout, /login -> auth\/login\/controller\.tsx \[missing\]/)
    assert.match(result.stdout, /action\s+POST\s+\/auth\/login(?!\s+->)/)
    assert.equal(result.stderr, '')
  })

  it('rejects --json when combined with table formatting', async () => {
    let result = await runRoutesCommand(['--json', '--table'], getFixturePath('routes-basic'))

    assert.equal(result.status, 1)
    assert.match(result.stderr, /Cannot combine --json with --table/)
  })

  it('rejects --json when combined with verbose formatting', async () => {
    let result = await runRoutesCommand(['--json', '--verbose'], getFixturePath('routes-basic'))

    assert.equal(result.status, 1)
    assert.match(result.stderr, /Cannot combine --json with --verbose/)
  })

  it('rejects --no-headers without table formatting', async () => {
    let result = await runRoutesCommand(['--no-headers'], getFixturePath('routes-basic'))

    assert.equal(result.status, 1)
    assert.match(result.stderr, /Cannot use --no-headers without --table/)
  })

  it('fails when no app/routes.ts can be found', async () => {
    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-routes-'))

    try {
      let result = await runRoutesCommand([], tmpDir)

      assert.equal(result.status, 1)
      assert.match(result.stderr, /Could not find app\/routes\.ts/)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('fails when the route module does not export routes', async () => {
    let result = await runRoutesCommand([], getFixturePath('routes-no-export'))

    assert.equal(result.status, 1)
    assert.match(result.stderr, /must export a named "routes" value/)
  })

  it('fails when the route map contains invalid values', async () => {
    let result = await runRoutesCommand([], getFixturePath('routes-invalid-value'))

    assert.equal(result.status, 1)
    assert.match(result.stderr, /Invalid route map value at "broken"/)
  })

  it('fails when importing the route module throws', async () => {
    let result = await runRoutesCommand([], getFixturePath('routes-import-error'))

    assert.equal(result.status, 1)
    assert.match(result.stderr, /boom from routes fixture/)
  })
})

function findRouteNode(tree: RouteTreeNode[], name: string): RouteTreeNode | undefined {
  for (let node of tree) {
    if (node.name === name) {
      return node
    }

    let child = findRouteNode(node.children, name)
    if (child != null) {
      return child
    }
  }

  return undefined
}

async function runRoutesCommand(args: string[], cwd: string) {
  return await captureOutput(() => runRemix(['routes', ...args], { cwd }))
}

async function captureOutput(
  callback: () => Promise<number>,
): Promise<{ status: number; stderr: string; stdout: string }> {
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
    let status = await callback()
    return { status, stderr, stdout }
  } finally {
    process.stdout.write = originalStdoutWrite
    process.stderr.write = originalStderrWrite
  }
}

interface RouteTreeNode {
  children: RouteTreeNode[]
  kind: 'group' | 'route'
  method?: string
  name: string
  owner: {
    exists: boolean
    kind: 'action' | 'controller'
    path: string
  }
  pattern?: string
}
