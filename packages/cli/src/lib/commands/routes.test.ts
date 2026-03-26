import * as assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { getFixturePath } from '../../../test/fixtures.ts'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..')
const CLI_ENTRY_PATH = path.join(ROOT_DIR, 'packages', 'cli', 'src', 'index.ts')

describe('routes command', () => {
  it('prints routes command help', async () => {
    let result = runRoutesCommand(['--help'], ROOT_DIR)

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Usage:\s+remix routes \[--json\]/)
    assert.match(result.stdout, /Show the Remix route tree/)
    assert.equal(result.stderr, '')
  })

  it('prints flat leaf mappings for a basic fixture app', async () => {
    let result = runRoutesCommand([], getFixturePath('routes-basic'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /home\s+ANY\s+\/\s+-> app\/controllers\/home\.tsx/)
    assert.match(result.stdout, /auth\s+ANY\s+\/auth\s+-> app\/controllers\/auth\.tsx/)
    assert.equal(result.stderr, '')
  })

  it('works from a nested directory inside an app', async () => {
    let nestedDir = path.join(getFixturePath('routes-tree'), 'app', 'controllers', 'admin')
    let result = runRoutesCommand([], nestedDir)

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /auth -> app\/controllers\/auth\/controller\.tsx/)
    assert.match(result.stdout, /login -> app\/controllers\/auth\/login\/controller\.tsx/)
    assert.match(
      result.stdout,
      /action POST\s+\/login -> app\/controllers\/auth\/login\/controller\.tsx/,
    )
    assert.match(result.stdout, /orders -> app\/controllers\/account\/orders\/controller\.tsx/)
    assert.equal(result.stderr, '')
  })

  it('resolves owner files with js, jsx, and ts extensions', async () => {
    let result = runRoutesCommand([], getFixturePath('doctor-clean'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /home\s+ANY\s+\/\s+-> app\/controllers\/home\.js/)
    assert.match(result.stdout, /about\s+ANY\s+\/about\s+-> app\/controllers\/about\.jsx/)
    assert.match(result.stdout, /contact -> app\/controllers\/contact\/controller\.ts/)
    assert.equal(result.stderr, '')
  })

  it('prints normalized JSON with owner metadata', async () => {
    let fixtureDir = getFixturePath('routes-tree')
    let result = runRoutesCommand(['--json'], fixtureDir)

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
    let result = runRoutesCommand([], getFixturePath('routes-missing'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /home\s+ANY\s+\/\s+-> app\/controllers\/home\.tsx \[missing\]/)
    assert.match(result.stdout, /auth -> app\/controllers\/auth\/controller\.tsx \[missing\]/)
    assert.match(
      result.stdout,
      /action POST\s+\/auth\/login -> app\/controllers\/auth\/login\/controller\.tsx \[missing\]/,
    )
    assert.equal(result.stderr, '')
  })

  it('fails when no app/routes.ts can be found', async () => {
    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-routes-'))

    try {
      let result = runRoutesCommand([], tmpDir)

      assert.equal(result.status, 1)
      assert.match(result.stderr, /Could not find app\/routes\.ts/)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('fails when the route module does not export routes', async () => {
    let result = runRoutesCommand([], getFixturePath('routes-no-export'))

    assert.equal(result.status, 1)
    assert.match(result.stderr, /must export a named "routes" value/)
  })

  it('fails when the route map contains invalid values', async () => {
    let result = runRoutesCommand([], getFixturePath('routes-invalid-value'))

    assert.equal(result.status, 1)
    assert.match(result.stderr, /Invalid route map value at "broken"/)
  })

  it('fails when importing the route module throws', async () => {
    let result = runRoutesCommand([], getFixturePath('routes-import-error'))

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

function runRoutesCommand(args: string[], cwd: string) {
  return spawnSync(process.execPath, [CLI_ENTRY_PATH, 'routes', ...args], {
    cwd,
    encoding: 'utf8',
  })
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
