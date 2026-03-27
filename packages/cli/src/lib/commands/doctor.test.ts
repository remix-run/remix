import * as assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
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
    assert.match(result.stdout, /Usage:\s+remix doctor \[--json\] \[--strict\]/)
    assert.match(result.stdout, /Check Remix controller-directory conventions/)
    assert.equal(result.stderr, '')
  })

  it('works from a nested directory inside an app', async () => {
    let nestedDir = path.join(getFixturePath('doctor-clean'), 'app', 'controllers', 'contact')
    let result = runDoctorCommand([], nestedDir)

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /^controllers/m)
    assert.match(result.stdout, /Doctor found no issues\./)
    assert.equal(result.stderr, '')
  })

  it('reports no findings for a clean fixture', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-clean'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /^controllers/m)
    assert.match(result.stdout, /No findings\./)
    assert.match(result.stdout, /Summary: 0 warnings, 0 advice\./)
    assert.equal(result.stderr, '')
  })

  it('does not print color when NO_COLOR is set', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-missing'))

    assert.equal(result.status, 0, result.stderr)
    assert.doesNotMatch(result.stdout, /\u001B\[/)
    assert.equal(result.stderr, '')
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

  it('colors warnings yellow and errors red', async () => {
    let warningResult = runDoctorCommand([], getFixturePath('doctor-missing'), { color: true })
    let errorResult = runDoctorCommand([], getFixturePath('routes-no-export'), { color: true })

    assert.equal(warningResult.status, 0, warningResult.stderr)
    assert.match(
      warningResult.stdout,
      /\u001B\[93m  WARN Route "home" is missing action app\/controllers\/home\.tsx\.\u001B\[0m/,
    )
    assert.match(warningResult.stdout, /Summary: 2 warnings, 0 advice\.\n\u001B\[0m$/)

    assert.equal(errorResult.status, 1)
    assert.match(
      errorResult.stderr,
      /\u001B\[91m[\s\S]*must export a named "routes" value\.[\s\S]*\u001B\[0m/,
    )
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
    assert.match(result.stdout, /No findings\./)
    assert.doesNotMatch(result.stdout, /shared-bucket/)
    assert.equal(result.stderr, '')
  })

  it('prints machine-readable findings as json', async () => {
    let fixtureDir = getFixturePath('doctor-wrong-kind')
    let result = runDoctorCommand(['--json'], fixtureDir)

    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stderr, '')

    let payload = JSON.parse(result.stdout) as DoctorReport
    let suite = payload.suites[0]
    let home = suite.findings.find((finding) => finding.routeName === 'home')
    let contact = suite.findings.find((finding) => finding.routeName === 'contact')

    assert.equal(payload.appRoot, fixtureDir)
    assert.equal(payload.routesFile, path.join(fixtureDir, 'app', 'routes.ts'))
    assert.equal(suite.name, 'controllers')
    assert.ok(home)
    assert.equal(home.code, 'wrong-owner-kind')
    assert.equal(home.expectedPath, 'app/controllers/home.tsx')
    assert.equal(home.actualPath, 'app/controllers/home/controller.js')
    assert.ok(contact)
    assert.equal(contact.code, 'wrong-owner-kind')
    assert.equal(contact.expectedPath, 'app/controllers/contact/controller.tsx')
    assert.equal(contact.actualPath, 'app/controllers/contact.ts')
  })

  it('fails strict mode when warning findings are present', async () => {
    let result = runDoctorCommand(['--strict'], getFixturePath('doctor-wrong-kind'))

    assert.equal(result.status, 1)
    assert.match(result.stdout, /Summary: 2 warnings, 0 advice\./)
    assert.equal(result.stderr, '')
  })

  it('propagates route-map loader failures', async () => {
    let result = runDoctorCommand([], getFixturePath('routes-no-export'))

    assert.equal(result.status, 1)
    assert.match(result.stderr, /must export a named "routes" value/)
  })
})

function runDoctorCommand(args: string[], cwd: string, options: { color?: boolean } = {}) {
  let env = { ...process.env }

  if (options.color) {
    delete env.NO_COLOR
  } else {
    env.NO_COLOR = '1'
  }

  return spawnSync(process.execPath, [CLI_ENTRY_PATH, 'doctor', ...args], {
    cwd,
    encoding: 'utf8',
    env,
  })
}

interface DoctorReport {
  appRoot: string
  findings: DoctorFinding[]
  routesFile: string
  suites: [DoctorSuite]
}

interface DoctorSuite {
  findings: DoctorFinding[]
  name: 'controllers'
}

interface DoctorFinding {
  actualPath?: string
  code:
    | 'ambiguous-owner'
    | 'duplicate-owner-file'
    | 'incomplete-controller'
    | 'missing-owner'
    | 'orphan-action'
    | 'orphan-controller'
    | 'orphan-route-directory'
    | 'promotion-drift'
    | 'wrong-owner-kind'
  expectedPath?: string
  message: string
  routeName?: string
  severity: 'advice' | 'warn'
  suite: 'controllers'
}
