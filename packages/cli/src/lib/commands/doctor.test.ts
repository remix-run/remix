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

  it('reports generic buckets as advice and does not fail strict mode for advice only', async () => {
    let fixtureDir = getFixturePath('doctor-generic-buckets')
    let result = runDoctorCommand([], fixtureDir)
    let strictResult = runDoctorCommand(['--strict'], fixtureDir)

    assert.equal(result.status, 0, result.stderr)
    assert.match(
      result.stdout,
      /ADVICE app\/controllers\/components uses a generic shared-bucket name inside app\/controllers\./,
    )
    assert.match(
      result.stdout,
      /ADVICE app\/controllers\/helpers\.js uses a generic shared-bucket name inside app\/controllers\./,
    )
    assert.equal(strictResult.status, 0, strictResult.stderr)
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

function runDoctorCommand(args: string[], cwd: string) {
  return spawnSync(process.execPath, [CLI_ENTRY_PATH, 'doctor', ...args], {
    cwd,
    encoding: 'utf8',
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
    | 'generic-bucket'
    | 'missing-owner'
    | 'orphan-action'
    | 'orphan-controller'
    | 'wrong-owner-kind'
  expectedPath?: string
  message: string
  routeName?: string
  severity: 'advice' | 'warn'
  suite: 'controllers'
}
