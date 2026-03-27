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

describe('doctor command', () => {
  it('prints doctor command help', async () => {
    let result = runDoctorCommand(['--help'], ROOT_DIR)

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Usage:\s+remix doctor \[--json\] \[--strict\] \[--no-color\]/)
    assert.match(result.stdout, /Check project environment and Remix app conventions/)
    assert.equal(result.stderr, '')
  })

  it('works from a nested directory inside an app', async () => {
    let nestedDir = path.join(getFixturePath('doctor-clean'), 'app', 'controllers', 'contact')
    let result = runDoctorCommand([], nestedDir)

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /^environment/m)
    assert.match(result.stdout, /^project-contract/m)
    assert.match(result.stdout, /^controllers/m)
    assert.match(result.stdout, /Doctor found no issues\./)
    assert.equal(result.stderr, '')
  })

  it('reports no findings for a clean fixture', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-clean'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /^environment\n  No findings\./m)
    assert.match(result.stdout, /^project-contract\n  No findings\./m)
    assert.match(result.stdout, /^controllers\n  No findings\./m)
    assert.match(result.stdout, /Summary: 0 warnings, 0 advice\./)
    assert.equal(result.stderr, '')
  })

  it('does not print color when output is not a tty', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-missing'))

    assert.equal(result.status, 0, result.stderr)
    assert.doesNotMatch(result.stdout, /\u001B\[/)
    assert.equal(result.stderr, '')
  })

  it('reports environment warnings and skips later suites when package.json is missing', async () => {
    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-doctor-no-package-'))

    try {
      let result = runDoctorCommand([], tmpDir)

      assert.equal(result.status, 0, result.stderr)
      assert.match(result.stdout, /WARN Could not find package\.json/)
      assert.match(
        result.stdout,
        /^project-contract\n  Skipped: Blocked by environment warnings\./m,
      )
      assert.match(result.stdout, /^controllers\n  Skipped: Blocked by environment warnings\./m)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('reports invalid package.json and skips later suites', async () => {
    let tmpDir = await createTempProject({
      'package.json': '{"name":"broken",',
    })

    try {
      let result = runDoctorCommand([], tmpDir)

      assert.equal(result.status, 0, result.stderr)
      assert.match(result.stdout, /WARN package\.json is not valid JSON\./)
      assert.match(
        result.stdout,
        /^project-contract\n  Skipped: Blocked by environment warnings\./m,
      )
      assert.match(result.stdout, /^controllers\n  Skipped: Blocked by environment warnings\./m)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('reports unsupported node versions and skips later suites', async () => {
    let tmpDir = await createTempProject({
      'package.json': JSON.stringify(
        {
          dependencies: {
            remix: 'workspace:*',
          },
          engines: {
            node: '>=99.0.0',
          },
          name: 'doctor-env-unsupported-node-fixture',
          private: true,
          type: 'module',
        },
        null,
        2,
      ),
    })

    try {
      await fs.mkdir(path.join(tmpDir, 'node_modules'), { recursive: true })
      await fs.symlink(
        path.join(ROOT_DIR, 'packages', 'remix'),
        path.join(tmpDir, 'node_modules', 'remix'),
      )

      let result = runDoctorCommand([], tmpDir)

      assert.equal(result.status, 0, result.stderr)
      assert.match(
        result.stdout,
        /WARN Project requires Node\.js >=99\.0\.0, but the current runtime is v\d+\.\d+\.\d+\./,
      )
      assert.match(
        result.stdout,
        /^project-contract\n  Skipped: Blocked by environment warnings\./m,
      )
      assert.match(result.stdout, /^controllers\n  Skipped: Blocked by environment warnings\./m)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('reports missing remix dependencies and skips later suites', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-env-missing-remix-dependency'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /WARN package\.json does not declare a remix dependency\./)
    assert.match(result.stdout, /^project-contract\n  Skipped: Blocked by environment warnings\./m)
    assert.match(result.stdout, /^controllers\n  Skipped: Blocked by environment warnings\./m)
  })

  it('reports unresolved remix installs and skips later suites', async () => {
    let tmpDir = await createTempProject({
      'package.json': JSON.stringify(
        {
          dependencies: {
            remix: '1.0.0',
          },
          engines: {
            node: '>=24.3.0',
          },
          name: 'doctor-env-unresolved-install-fixture',
          private: true,
          type: 'module',
        },
        null,
        2,
      ),
    })

    try {
      let result = runDoctorCommand([], tmpDir)

      assert.equal(result.status, 0, result.stderr)
      assert.match(result.stdout, /WARN Could not resolve remix from this project\./)
      assert.match(
        result.stdout,
        /^project-contract\n  Skipped: Blocked by environment warnings\./m,
      )
      assert.match(result.stdout, /^controllers\n  Skipped: Blocked by environment warnings\./m)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('reports missing app routes files and skips controllers', async () => {
    let tmpDir = await createTempProject({
      'package.json': JSON.stringify(
        {
          dependencies: {
            remix: 'workspace:*',
          },
          engines: {
            node: '>=24.3.0',
          },
          name: 'doctor-project-routes-missing-fixture',
          private: true,
          type: 'module',
        },
        null,
        2,
      ),
    })

    try {
      await fs.mkdir(path.join(tmpDir, 'node_modules'), { recursive: true })
      await fs.symlink(
        path.join(ROOT_DIR, 'packages', 'remix'),
        path.join(tmpDir, 'node_modules', 'remix'),
      )

      let result = runDoctorCommand([], tmpDir)

      assert.equal(result.status, 0, result.stderr)
      assert.match(result.stdout, /^environment\n  No findings\./m)
      assert.match(result.stdout, /WARN Project is missing app\/routes\.ts\./)
      assert.match(
        result.stdout,
        /^controllers\n  Skipped: Blocked by project-contract warnings\./m,
      )
      assert.equal(result.stderr, '')
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('reports missing action and controller owners', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-missing'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /WARN Route "home" is missing action app\/controllers\/home\.tsx\./)
    assert.match(
      result.stdout,
      /WARN Route "contact" is missing controller app\/controllers\/contact\/controller\.tsx\./,
    )
    assert.equal(result.stderr, '')
  })

  it('accepts the global no-color flag', async () => {
    let result = runDoctorCommand(['--no-color'], getFixturePath('doctor-missing'))

    assert.equal(result.status, 0, result.stderr)
    assert.doesNotMatch(result.stdout, /\u001B\[/)
  })

  it('reports duplicate owner files for actions and controllers', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-duplicate-owner'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(
      result.stdout,
      /WARN Route "home" has multiple action files: app\/controllers\/home\.ts, app\/controllers\/home\.tsx\. Keep only one action owner file\./,
    )
    assert.match(
      result.stdout,
      /WARN Route "contact" has multiple controller files: app\/controllers\/contact\/controller\.ts, app\/controllers\/contact\/controller\.jsx\. Keep only one controller owner file\./,
    )
    assert.equal(result.stderr, '')
  })

  it('reports incomplete controllers when a controller folder is missing its entry file', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-incomplete-controller'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(
      result.stdout,
      /WARN Route "contact" has files under app\/controllers\/contact, but is missing controller app\/controllers\/contact\/controller\.tsx\./,
    )
    assert.doesNotMatch(result.stdout, /Route "contact" is missing controller/)
    assert.equal(result.stderr, '')
  })

  it('reports wrong owner kinds for actions and controller folders', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-wrong-kind'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(
      result.stdout,
      /WARN Route "home" expects action app\/controllers\/home\.tsx, but found controller app\/controllers\/home\/controller\.js\./,
    )
    assert.match(
      result.stdout,
      /WARN Route "contact" expects controller app\/controllers\/contact\/controller\.tsx, but found standalone action app\/controllers\/contact\.ts\./,
    )
    assert.equal(result.stderr, '')
  })

  it('reports promotion drift for standalone actions that also have route-local files', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-promotion-drift'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(
      result.stdout,
      /WARN Route "home" uses action app\/controllers\/home\.js, but also has files under app\/controllers\/home\. Promote it to controller app\/controllers\/home\/controller\.tsx or keep the route in app\/controllers\/home\.js\./,
    )
    assert.equal(result.stderr, '')
  })

  it('reports ambiguous owner mappings', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-ambiguous'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(
      result.stdout,
      /WARN Route "home" has both action app\/controllers\/home\.js and controller app\/controllers\/home\/controller\.ts\./,
    )
    assert.match(
      result.stdout,
      /WARN Route "contact" has both controller app\/controllers\/contact\/controller\.jsx and standalone action app\/controllers\/contact\.ts\./,
    )
    assert.equal(result.stderr, '')
  })

  it('reports orphan actions and controller folders', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-orphans'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(
      result.stdout,
      /WARN Standalone action app\/controllers\/about\.jsx does not match any top-level route\./,
    )
    assert.match(
      result.stdout,
      /WARN Controller app\/controllers\/unused\/controller\.js does not match any route group\./,
    )
    assert.equal(result.stderr, '')
  })

  it('reports extraneous route directories outside any controller route', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-orphan-route-local-file'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(
      result.stdout,
      /WARN Directory app\/controllers\/unused does not match any route subtree\./,
    )
    assert.equal(result.stderr, '')
  })

  it('reports extraneous route directories from the controller tree shape', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-generic-buckets'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(
      result.stdout,
      /WARN Directory app\/controllers\/components does not match any route subtree\./,
    )
    assert.match(
      result.stdout,
      /WARN Standalone action app\/controllers\/helpers\.js does not match any top-level route\./,
    )
    assert.doesNotMatch(
      result.stdout,
      /Route-local file app\/controllers\/components\/example\.jsx does not live under any controller route\./,
    )
    assert.equal(result.stderr, '')
  })

  it('allows route names like shared and common when the route map declares them', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-route-names'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /^controllers\n  No findings\./m)
    assert.doesNotMatch(result.stdout, /shared-bucket/)
    assert.equal(result.stderr, '')
  })

  it('uses kebab-case controller paths for camelCase route keys', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-camel-case-keys'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /^controllers\n  No findings\./m)
    assert.doesNotMatch(result.stdout, /forgotPassword/)
    assert.doesNotMatch(result.stdout, /resetPassword/)
    assert.equal(result.stderr, '')
  })

  it('reports project-contract warnings when routes is not exported', async () => {
    let result = runDoctorCommand([], getFixturePath('routes-no-export'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /must export a named "routes" value/)
    assert.match(result.stdout, /^controllers\n  Skipped: Blocked by project-contract warnings\./m)
    assert.equal(result.stderr, '')
  })

  it('reports project-contract warnings when the route map is invalid', async () => {
    let result = runDoctorCommand([], getFixturePath('routes-invalid-value'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Invalid route map value at "broken"/)
    assert.match(result.stdout, /^controllers\n  Skipped: Blocked by project-contract warnings\./m)
    assert.equal(result.stderr, '')
  })

  it('reports project-contract warnings when importing routes throws', async () => {
    let result = runDoctorCommand([], getFixturePath('routes-import-error'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Failed to load app\/routes\.ts: boom from routes fixture/)
    assert.match(result.stdout, /^controllers\n  Skipped: Blocked by project-contract warnings\./m)
    assert.equal(result.stderr, '')
  })

  it('prints machine-readable findings as json', async () => {
    let fixtureDir = getFixturePath('doctor-wrong-kind')
    let result = runDoctorCommand(['--json'], fixtureDir)

    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stderr, '')

    let payload = JSON.parse(result.stdout) as DoctorReport
    let environmentSuite = payload.suites.find((suite) => suite.name === 'environment')
    let projectContractSuite = payload.suites.find((suite) => suite.name === 'project-contract')
    let controllersSuite = payload.suites.find((suite) => suite.name === 'controllers')
    let home = controllersSuite?.findings.find((finding) => finding.routeName === 'home')
    let contact = controllersSuite?.findings.find((finding) => finding.routeName === 'contact')

    assert.equal(payload.appRoot, fixtureDir)
    assert.equal(payload.routesFile, path.join(fixtureDir, 'app', 'routes.ts'))
    assert.equal(payload.findings.length, 2)
    assert.equal(environmentSuite?.status, 'ok')
    assert.equal(projectContractSuite?.status, 'ok')
    assert.equal(controllersSuite?.status, 'issues')
    assert.ok(home)
    assert.equal(home.code, 'wrong-owner-kind')
    assert.equal(home.expectedPath, 'app/controllers/home.tsx')
    assert.equal(home.actualPath, 'app/controllers/home/controller.js')
    assert.ok(contact)
    assert.equal(contact.code, 'wrong-owner-kind')
    assert.equal(contact.expectedPath, 'app/controllers/contact/controller.tsx')
    assert.equal(contact.actualPath, 'app/controllers/contact.ts')
  })

  it('prints skipped suites as json when project-contract blocks controllers', async () => {
    let fixtureDir = getFixturePath('routes-no-export')
    let result = runDoctorCommand(['--json'], fixtureDir)

    assert.equal(result.status, 0, result.stderr)

    let payload = JSON.parse(result.stdout) as DoctorReport
    let projectContractSuite = payload.suites.find((suite) => suite.name === 'project-contract')
    let controllersSuite = payload.suites.find((suite) => suite.name === 'controllers')

    assert.equal(projectContractSuite?.status, 'issues')
    assert.equal(controllersSuite?.status, 'skipped')
    assert.equal(controllersSuite?.reason, 'Blocked by project-contract warnings.')
  })

  it('fails strict mode when controller warnings are present', async () => {
    let result = runDoctorCommand(['--strict'], getFixturePath('doctor-wrong-kind'))

    assert.equal(result.status, 1)
    assert.match(result.stdout, /Summary: 2 warnings, 0 advice\./)
    assert.equal(result.stderr, '')
  })

  it('fails strict mode when project-contract warnings are present', async () => {
    let result = runDoctorCommand(['--strict'], getFixturePath('routes-no-export'))

    assert.equal(result.status, 1)
    assert.match(result.stdout, /must export a named "routes" value/)
    assert.equal(result.stderr, '')
  })
})

function runDoctorCommand(args: string[], cwd: string) {
  return spawnSync(process.execPath, [CLI_ENTRY_PATH, 'doctor', ...args], {
    cwd,
    encoding: 'utf8',
  })
}

async function createTempProject(files: Record<string, string>): Promise<string> {
  let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-doctor-'))

  for (let [filePath, contents] of Object.entries(files)) {
    let absolutePath = path.join(projectDir, filePath)
    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    await fs.writeFile(absolutePath, `${contents}\n`, 'utf8')
  }

  return projectDir
}

interface DoctorReport {
  appRoot?: string
  findings: DoctorFinding[]
  routesFile?: string
  suites: DoctorSuite[]
}

interface DoctorSuite {
  findings: DoctorFinding[]
  name: 'controllers' | 'environment' | 'project-contract'
  reason?: string
  status: 'issues' | 'ok' | 'skipped'
}

interface DoctorFinding {
  actualPath?: string
  code:
    | 'ambiguous-owner'
    | 'duplicate-owner-file'
    | 'incomplete-controller'
    | 'missing-owner'
    | 'node-engine-missing'
    | 'node-engine-unparseable'
    | 'node-version-unsupported'
    | 'orphan-action'
    | 'orphan-controller'
    | 'orphan-route-directory'
    | 'package-json-invalid'
    | 'package-json-read-failed'
    | 'project-root-not-found'
    | 'promotion-drift'
    | 'remix-dependency-missing'
    | 'remix-install-missing'
    | 'route-map-invalid'
    | 'route-map-invalid-json'
    | 'route-map-loader-signal'
    | 'route-module-import-failed'
    | 'routes-export-missing'
    | 'routes-file-missing'
    | 'wrong-owner-kind'
  expectedPath?: string
  message: string
  routeName?: string
  severity: 'advice' | 'warn'
  suite: 'controllers' | 'environment' | 'project-contract'
}
