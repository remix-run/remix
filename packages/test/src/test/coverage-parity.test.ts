import * as assert from '@remix-run/assert'
import { spawn } from 'node:child_process'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from '../lib/framework.ts'
import { IS_BUN } from '../lib/runtime.ts'

const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const PARITY_DIR = path.join(PKG_DIR, '.coverage', 'parity')
const FIXTURE_PATH = path.join('src', 'test', 'coverage', 'fixture.ts')

interface RunSpec {
  type: 'server' | 'browser' | 'e2e'
  glob: string
}

const RUNS: readonly RunSpec[] = [
  { type: 'server', glob: 'src/test/coverage/test-unit.ts' },
  { type: 'browser', glob: 'src/test/coverage/test-browser.ts' },
  { type: 'e2e', glob: 'src/test/coverage/test-e2e.ts' },
]

async function runWithCoverage(spec: RunSpec, dir: string): Promise<void> {
  let args = [
    'src/cli-entry.ts',
    '--coverage',
    '--coverage.dir',
    dir,
    '--coverage.include',
    'src/{app,lib}/**/*.{ts,tsx}',
    // Needed for coverage parity test
    '--coverage.include',
    'src/test/coverage/fixture.ts',
    '--type',
    spec.type,
    '--glob.test',
    spec.glob,
    ...(spec.type !== 'server' ? [`--glob.${spec.type}`, spec.glob] : []),
  ]
  // Browser and e2e: pin to chromium. Firefox/webkit don't expose JS coverage
  // and would silently produce no entries.
  if (spec.type !== 'server') args.push('--project', 'chromium')

  // Buffer stdio so successful runs stay silent. If the child exits non-zero,
  // surface its output as part of the rejection so debugging is still possible.
  await new Promise<void>((resolve, reject) => {
    let child = spawn('node', args, { cwd: PKG_DIR, stdio: ['ignore', 'pipe', 'pipe'] })
    let chunks: Buffer[] = []
    child.stdout?.on('data', (c) => chunks.push(c))
    child.stderr?.on('data', (c) => chunks.push(c))
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) return resolve()
      let output = Buffer.concat(chunks).toString('utf-8')
      reject(new Error(`Coverage run for type=${spec.type} exited with ${code}\n${output}`))
    })
  })
}

function extractFixtureRecord(lcov: string): string {
  let blocks = lcov.split('end_of_record\n')
  let fixture = blocks.find((b) => b.includes(`SF:${FIXTURE_PATH}\n`))
  if (!fixture) {
    throw new Error(`Couldn't find SF:${FIXTURE_PATH} record in lcov.info`)
  }
  return fixture.trim()
}

describe('coverage parity', () => {
  // The bun test job only runs `--type server`, so it can't spawn browser/e2e
  // sub-runs (Playwright is Node-only). The Node test job covers parity.
  it('all three runners produce identical coverage for the fixture', { skip: IS_BUN }, async () => {
    await fsp.rm(PARITY_DIR, { recursive: true, force: true })

    let records = new Map<string, string>()
    for (let spec of RUNS) {
      let dir = path.join(PARITY_DIR, spec.type)
      await runWithCoverage(spec, dir)
      let lcov = await fsp.readFile(path.join(dir, 'lcov.info'), 'utf-8')
      records.set(spec.type, extractFixtureRecord(lcov))
    }

    let server = records.get('server')!
    let browser = records.get('browser')!
    let e2e = records.get('e2e')!

    assert.equal(browser, server, 'browser fixture coverage differs from server')
    assert.equal(e2e, server, 'e2e fixture coverage differs from server')
  })
})
