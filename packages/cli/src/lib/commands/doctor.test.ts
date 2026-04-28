import * as assert from '@remix-run/assert'
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, it } from '@remix-run/test'

import { getFixturePath } from '../../../test/fixtures.ts'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..')
const CLI_ENTRY_PATH = path.join(ROOT_DIR, 'packages', 'cli', 'src', 'cli.ts')
const REMIX_PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'packages', 'remix', 'package.json')

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

describe('doctor command', () => {
  it('prints doctor command help', async () => {
    let result = runDoctorCommand(['--help'], ROOT_DIR)

    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout, DOCTOR_COMMAND_HELP_TEXT)
    assert.equal(result.stderr, '')
  })

  it('works from a nested directory inside an app', async () => {
    let nestedDir = path.join(getFixturePath('doctor-clean'), 'app', 'controllers', 'contact')
    let result = runDoctorCommand([], nestedDir)

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✓ environment/)
    assert.match(result.stdout, /✓ project/)
    assert.match(result.stdout, /✓ controllers/)
    assert.match(result.stdout, /Doctor found no issues\./)
    assert.equal(result.stderr, '')
  })

  it('reports no findings for a clean fixture', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-clean'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(
      result.stdout,
      /\n• Checking environment\.\.\.\n✓ environment\n\n• Checking project\.\.\.\n✓ project\n\n• Checking controllers\.\.\.\n✓ controllers\n\nDoctor found no issues\.\nSummary: 0 warnings, 0 advice\.\n\n$/,
    )
    assert.equal(result.stderr, '')
  })

  it('applies no fixes for a clean fixture', async () => {
    let result = runDoctorCommand(['--fix'], getFixturePath('doctor-clean'))

    assert.equal(result.status, 0, result.stderr)
    assert.doesNotMatch(result.stdout, /Applied fixes:/)
    assert.match(result.stdout, /Doctor found no issues\./)
    assert.match(result.stdout, /✓ controllers/)
    assert.equal(result.stderr, '')
  })

  it('does not print color when output is not a tty', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-missing'))

    assert.equal(result.status, 0, result.stderr)
    assert.doesNotMatch(result.stdout, /\u001B\[/)
    assert.equal(result.stderr, '')
  })

  it('marks advice-only suites as passing while still printing the advice', async () => {
    let projectDir = await createTempProject(
      {
        'app/controllers/home.js': [
          'export const home = {',
          '  handler() {',
          "    return new Response('ok')",
          '  },',
          '}',
        ].join('\n'),
        'app/routes.ts': [
          "import { route } from 'remix/fetch-router/routes'",
          '',
          'export const routes = route({',
          "  home: '/',",
          '})',
        ].join('\n'),
        'package.json': JSON.stringify(
          {
            dependencies: {
              remix: 'workspace:*',
            },
            name: 'doctor-env-advice-only-fixture',
            private: true,
            type: 'module',
          },
          null,
          2,
        ),
      },
      { linkRemix: true },
    )

    try {
      let result = runDoctorCommand([], projectDir)

      assert.equal(result.status, 0, result.stderr)
      assert.match(result.stdout, /✓ environment/)
      assert.doesNotMatch(result.stdout, /✗ environment/)
      assert.match(
        result.stdout,
        /✓ environment\n  • \[ADVICE\] package\.json does not declare engines\.node\. Add one to document the supported Node\.js version\./,
      )
      assert.match(result.stdout, /✓ project/)
      assert.match(result.stdout, /✓ controllers/)
      assert.match(result.stdout, /Summary: 0 warnings, 1 advice\./)
      assert.equal(result.stderr, '')
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('reports environment warnings and skips later suites when package.json is missing', async () => {
    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-doctor-no-package-'))

    try {
      let result = runDoctorCommand([], tmpDir)

      assert.equal(result.status, 0, result.stderr)
      assert.match(result.stdout, /✗ environment/)
      assert.match(result.stdout, /• project \(skipped: Blocked by environment warnings\.\)/)
      assert.match(result.stdout, /• controllers \(skipped: Blocked by environment warnings\.\)/)
      assert.match(result.stdout, /✗ environment\n  • \[WARN\] Could not find package\.json\./)
      assert.equal(result.stderr, '')
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
      assert.match(result.stdout, /✗ environment/)
      assert.match(result.stdout, /• project \(skipped: Blocked by environment warnings\.\)/)
      assert.match(result.stdout, /• controllers \(skipped: Blocked by environment warnings\.\)/)
      assert.match(result.stdout, /✗ environment\n  • \[WARN\] package\.json is not valid JSON\./)
      assert.equal(result.stderr, '')
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
      assert.match(result.stdout, /✗ environment/)
      assert.match(
        result.stdout,
        /✗ environment\n  • \[WARN\] Project requires Node\.js >=99\.0\.0, but the current runtime is v\d+\.\d+\.\d+\./,
      )
      assert.match(result.stdout, /• project \(skipped: Blocked by environment warnings\.\)/)
      assert.match(result.stdout, /• controllers \(skipped: Blocked by environment warnings\.\)/)
      assert.equal(result.stderr, '')
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('accepts standard npm semver range syntax for engines.node', async () => {
    for (let { label, range } of getSupportedNodeRangeCases()) {
      let projectDir = await createTempProject(
        {
          'app/controllers/home.js': [
            'export const home = {',
            '  handler() {',
            "    return new Response('ok')",
            '  },',
            '}',
          ].join('\n'),
          'app/routes.ts': [
            "import { route } from 'remix/fetch-router/routes'",
            '',
            'export const routes = route({',
            "  home: '/',",
            '})',
          ].join('\n'),
          'package.json': JSON.stringify(
            {
              dependencies: {
                remix: 'latest',
              },
              engines: {
                node: range,
              },
              name: `doctor-env-${label}-range-fixture`,
              private: true,
              type: 'module',
            },
            null,
            2,
          ),
        },
        { linkRemix: true },
      )

      try {
        let checkResult = runDoctorCommand([], projectDir)

        assert.equal(checkResult.status, 0, `${label}: ${checkResult.stderr}`)
        assert.match(checkResult.stdout, /Doctor found no issues\./, label)
        assert.equal(checkResult.stderr, '', label)

        let fixResult = runDoctorCommand(['--fix'], projectDir)

        assert.equal(fixResult.status, 0, `${label}: ${fixResult.stderr}`)
        assert.doesNotMatch(fixResult.stdout, /Applied fixes:/, label)
        assert.match(fixResult.stdout, /Doctor found no issues\./, label)
        assert.equal(fixResult.stderr, '', label)

        let packageJson = JSON.parse(
          await fs.readFile(path.join(projectDir, 'package.json'), 'utf8'),
        ) as {
          engines: Record<string, string>
        }

        assert.equal(packageJson.engines.node, range, label)
      } finally {
        await fs.rm(projectDir, { recursive: true, force: true })
      }
    }
  })

  it('reports missing remix dependencies and skips later suites', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-env-missing-remix-dependency'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✗ environment/)
    assert.match(result.stdout, /• project \(skipped: Blocked by environment warnings\.\)/)
    assert.match(result.stdout, /• controllers \(skipped: Blocked by environment warnings\.\)/)
    assert.match(
      result.stdout,
      /✗ environment\n  • \[WARN\] package\.json does not declare a remix dependency\./,
    )
    assert.equal(result.stderr, '')
  })

  it('updates package.json with supported engines.node and a remix dependency', async () => {
    let projectDir = await createTempProject(
      {
        'app/controllers/home.js': [
          'export const home = {',
          '  handler() {',
          "    return new Response('ok')",
          '  },',
          '}',
        ].join('\n'),
        'app/routes.ts': [
          "import { route } from 'remix/fetch-router/routes'",
          '',
          'export const routes = route({',
          "  home: '/',",
          '})',
        ].join('\n'),
        'package.json': JSON.stringify(
          {
            name: 'doctor-fix-package-json-fixture',
            private: true,
            type: 'module',
          },
          null,
          2,
        ),
      },
      { linkRemix: true },
    )

    try {
      let fixResult = runDoctorCommand(['--fix'], projectDir)

      assert.equal(fixResult.status, 0, fixResult.stderr)
      assert.match(fixResult.stdout, /✓ environment/)
      assert.match(fixResult.stdout, /✓ environment\n  Applied fixes:\n    • Updated package\.json/)
      assert.equal(fixResult.stderr, '')

      let packageJson = JSON.parse(
        await fs.readFile(path.join(projectDir, 'package.json'), 'utf8'),
      ) as {
        dependencies: Record<string, string>
        engines: Record<string, string>
      }
      let remixPackageJson = JSON.parse(await fs.readFile(REMIX_PACKAGE_JSON_PATH, 'utf8')) as {
        version: string
      }

      assert.equal(packageJson.dependencies.remix, remixPackageJson.version)
      assert.equal(packageJson.engines.node, '>=24.3.0')

      let checkResult = runDoctorCommand([], projectDir)

      assert.equal(checkResult.status, 0, checkResult.stderr)
      assert.match(checkResult.stdout, /Doctor found no issues\./)
      assert.equal(checkResult.stderr, '')
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
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
      assert.match(result.stdout, /✗ environment/)
      assert.match(result.stdout, /• project \(skipped: Blocked by environment warnings\.\)/)
      assert.match(result.stdout, /• controllers \(skipped: Blocked by environment warnings\.\)/)
      assert.match(
        result.stdout,
        /✗ environment\n  • \[WARN\] Could not resolve remix from this project\./,
      )
      assert.equal(result.stderr, '')
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
      assert.match(result.stdout, /✓ environment/)
      assert.match(result.stdout, /✗ project/)
      assert.match(result.stdout, /• controllers \(skipped: Blocked by project warnings\.\)/)
      assert.match(result.stdout, /✗ project\n  • \[WARN\] Project is missing app\/routes\.ts\./)
      assert.equal(result.stderr, '')
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('updates unsupported engines.node to the supported floor', async () => {
    let projectDir = await createTempProject(
      {
        'app/controllers/home.js': [
          'export const home = {',
          '  handler() {',
          "    return new Response('ok')",
          '  },',
          '}',
        ].join('\n'),
        'app/routes.ts': [
          "import { route } from 'remix/fetch-router/routes'",
          '',
          'export const routes = route({',
          "  home: '/',",
          '})',
        ].join('\n'),
        'package.json': JSON.stringify(
          {
            dependencies: {
              remix: 'latest',
            },
            engines: {
              node: '>=99.0.0',
            },
            name: 'doctor-fix-node-engine-fixture',
            private: true,
            type: 'module',
          },
          null,
          2,
        ),
      },
      { linkRemix: true },
    )

    try {
      let fixResult = runDoctorCommand(['--fix'], projectDir)

      assert.equal(fixResult.status, 0, fixResult.stderr)
      assert.match(fixResult.stdout, /Updated package\.json/)
      assert.equal(fixResult.stderr, '')

      let packageJson = JSON.parse(
        await fs.readFile(path.join(projectDir, 'package.json'), 'utf8'),
      ) as {
        engines: Record<string, string>
      }

      assert.equal(packageJson.engines.node, '>=24.3.0')

      let checkResult = runDoctorCommand([], projectDir)

      assert.equal(checkResult.status, 0, checkResult.stderr)
      assert.match(checkResult.stdout, /Doctor found no issues\./)
      assert.equal(checkResult.stderr, '')
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('reports missing action and controller owners', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-missing'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✗ controllers/)
    assert.match(
      result.stdout,
      /✗ controllers\n  • \[WARN\] Route "home" is missing action app\/controllers\/home\.tsx\./,
    )
    assert.match(
      result.stdout,
      /• \[WARN\] Route "contact" is missing controller app\/controllers\/contact\/controller\.tsx\./,
    )
    assert.match(result.stdout, /controller\.tsx\.\n\nSummary: 2 warnings, 0 advice\./)
    assert.equal(result.stderr, '')
  })

  it('creates app/routes.ts and a default home action when routes are missing', async () => {
    let projectDir = await createTempProject(
      {
        'package.json': JSON.stringify(
          {
            dependencies: {
              remix: 'latest',
            },
            engines: {
              node: '>=24.3.0',
            },
            name: 'doctor-fix-routes-fixture',
            private: true,
            type: 'module',
          },
          null,
          2,
        ),
      },
      { linkRemix: true },
    )

    try {
      let fixResult = runDoctorCommand(['--fix'], projectDir)

      assert.equal(fixResult.status, 0, fixResult.stderr)
      assert.match(fixResult.stdout, /✓ project/)
      assert.match(fixResult.stdout, /✓ project\n  Applied fixes:/)
      assert.match(fixResult.stdout, /Created app\/routes\.ts/)
      assert.match(fixResult.stdout, /Created app\/controllers\/home\.js/)
      assert.equal(fixResult.stderr, '')

      let routesSource = await fs.readFile(path.join(projectDir, 'app', 'routes.ts'), 'utf8')
      let homeSource = await fs.readFile(
        path.join(projectDir, 'app', 'controllers', 'home.js'),
        'utf8',
      )

      assert.match(routesSource, /export const routes = route\(\{/)
      assert.match(routesSource, /home: '\//)
      assert.match(homeSource, /import \{ html \} from 'remix\/html-template'/)
      assert.match(homeSource, /import \{ createHtmlResponse \} from 'remix\/response\/html'/)
      assert.match(homeSource, /export const home = \{/)
      assert.match(homeSource, /handler\(\) \{\n\s+let page = html`/)
      assert.match(homeSource, /return createHtmlResponse\(page\)/)
      assert.match(homeSource, /<h1>Home<\/h1>/)

      let checkResult = runDoctorCommand([], projectDir)

      assert.equal(checkResult.status, 0, checkResult.stderr)
      assert.match(checkResult.stdout, /Doctor found no issues\./)
      assert.equal(checkResult.stderr, '')
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('replaces comment-only app/routes.ts and creates a default home action', async () => {
    let projectDir = await createTempProject(
      {
        'app/routes.ts': ['// TODO: define routes', '', '/* routes coming soon */'].join('\n'),
        'package.json': JSON.stringify(
          {
            dependencies: {
              remix: 'latest',
            },
            engines: {
              node: '>=24.3.0',
            },
            name: 'doctor-fix-empty-routes-fixture',
            private: true,
            type: 'module',
          },
          null,
          2,
        ),
      },
      { linkRemix: true },
    )

    try {
      let fixResult = runDoctorCommand(['--fix'], projectDir)

      assert.equal(fixResult.status, 0, fixResult.stderr)
      assert.match(fixResult.stdout, /✓ project/)
      assert.match(fixResult.stdout, /Updated app\/routes\.ts/)
      assert.match(fixResult.stdout, /Created app\/controllers\/home\.js/)
      assert.equal(fixResult.stderr, '')

      let routesSource = await fs.readFile(path.join(projectDir, 'app', 'routes.ts'), 'utf8')
      let homeSource = await fs.readFile(
        path.join(projectDir, 'app', 'controllers', 'home.js'),
        'utf8',
      )

      assert.match(routesSource, /export const routes = route\(\{/)
      assert.match(routesSource, /home: '\//)
      assert.match(homeSource, /export const home = \{/)

      let checkResult = runDoctorCommand([], projectDir)

      assert.equal(checkResult.status, 0, checkResult.stderr)
      assert.match(checkResult.stdout, /Doctor found no issues\./)
      assert.equal(checkResult.stderr, '')
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('creates runnable placeholder owners for missing routes and leaves the project clean', async () => {
    let projectDir = await copyFixtureProject('doctor-missing')

    try {
      let fixResult = runDoctorCommand(['--fix'], projectDir)

      assert.equal(fixResult.status, 0, fixResult.stderr)
      assert.match(fixResult.stdout, /✓ controllers/)
      assert.match(fixResult.stdout, /Applied fixes:/)
      assert.match(fixResult.stdout, /Created app\/controllers\/home\.js/)
      assert.match(fixResult.stdout, /Created app\/controllers\/contact\/controller\.js/)
      assert.match(fixResult.stdout, /Applied 2 fixes\./)
      assert.match(fixResult.stdout, /Doctor found no issues\./)
      assert.equal(fixResult.stderr, '')

      let homeSource = await fs.readFile(
        path.join(projectDir, 'app', 'controllers', 'home.js'),
        'utf8',
      )
      let contactSource = await fs.readFile(
        path.join(projectDir, 'app', 'controllers', 'contact', 'controller.js'),
        'utf8',
      )

      assert.match(homeSource, /export const home = \{/)
      assert.match(homeSource, /TODO: implement routes\.home/)
      assert.match(contactSource, /export default \{/)
      assert.match(contactSource, /index\(\) \{/)
      assert.match(contactSource, /action\(\) \{/)
      assert.match(contactSource, /TODO: implement routes\.contact\.index/)
      assert.match(contactSource, /TODO: implement routes\.contact\.action/)

      let checkResult = runDoctorCommand([], projectDir)

      assert.equal(checkResult.status, 0, checkResult.stderr)
      assert.match(checkResult.stdout, /Doctor found no issues\./)
      assert.equal(checkResult.stderr, '')
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('creates a safe placeholder export name for non-identifier route keys', async () => {
    let projectDir = await createTempProject(
      {
        'app/routes.ts': [
          "import { route } from 'remix/fetch-router/routes'",
          '',
          'export const routes = route({',
          "  'sales-report': '/sales-report',",
          '})',
        ].join('\n'),
        'package.json': JSON.stringify(
          {
            dependencies: {
              remix: 'latest',
            },
            engines: {
              node: '>=24.3.0',
            },
            name: 'doctor-fix-non-identifier-route-key-fixture',
            private: true,
            type: 'module',
          },
          null,
          2,
        ),
      },
      { linkRemix: true },
    )

    try {
      let fixResult = runDoctorCommand(['--fix'], projectDir)

      assert.equal(fixResult.status, 0, fixResult.stderr)
      assert.match(fixResult.stdout, /Created app\/controllers\/sales-report\.js/)

      let actionSource = await fs.readFile(
        path.join(projectDir, 'app', 'controllers', 'sales-report.js'),
        'utf8',
      )

      assert.match(actionSource, /export const salesReport = \{/)
      assert.doesNotMatch(actionSource, /export const sales-report = \{/)

      let checkResult = runDoctorCommand([], projectDir)

      assert.equal(checkResult.status, 0, checkResult.stderr)
      assert.match(checkResult.stdout, /Doctor found no issues\./)
      assert.equal(checkResult.stderr, '')
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('sanitizes traversal route keys before generating doctor fix paths', async () => {
    let projectDir = await createTempProject(
      {
        'app/routes.ts': [
          "import { route } from 'remix/fetch-router/routes'",
          '',
          'export const routes = route({',
          "  '../../../escape': '/escape',",
          '})',
        ].join('\n'),
        'package.json': JSON.stringify(
          {
            dependencies: {
              remix: 'latest',
            },
            engines: {
              node: '>=24.3.0',
            },
            name: 'doctor-fix-traversal-route-key-fixture',
            private: true,
            type: 'module',
          },
          null,
          2,
        ),
      },
      { linkRemix: true },
    )

    try {
      let outsidePath = path.join(path.dirname(projectDir), 'escape.js')
      let fixResult = runDoctorCommand(['--fix'], projectDir)

      assert.equal(fixResult.status, 0, fixResult.stderr)
      assert.match(fixResult.stdout, /Created app\/controllers\/escape\.js/)
      await assertPathExists(path.join(projectDir, 'app', 'controllers', 'escape.js'))
      await assertPathMissing(outsidePath)

      let checkResult = runDoctorCommand([], projectDir)

      assert.equal(checkResult.status, 0, checkResult.stderr)
      assert.match(checkResult.stdout, /Doctor found no issues\./)
      assert.equal(checkResult.stderr, '')
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('creates a jsx home action placeholder when the project uses tsx', async () => {
    let projectDir = await createTempProject(
      {
        'package.json': JSON.stringify(
          {
            dependencies: {
              remix: 'latest',
            },
            engines: {
              node: '>=24.3.0',
            },
            name: 'doctor-fix-routes-tsx-fixture',
            private: true,
            type: 'module',
          },
          null,
          2,
        ),
        'tsconfig.json': JSON.stringify(
          {
            compilerOptions: {
              jsx: 'react-jsx',
            },
          },
          null,
          2,
        ),
      },
      { linkRemix: true },
    )

    try {
      let fixResult = runDoctorCommand(['--fix'], projectDir)

      assert.equal(fixResult.status, 0, fixResult.stderr)
      assert.match(fixResult.stdout, /Created app\/controllers\/home\.tsx/)

      let homeSource = await fs.readFile(
        path.join(projectDir, 'app', 'controllers', 'home.tsx'),
        'utf8',
      )

      assert.match(homeSource, /import \{ renderToStream \} from 'remix\/component\/server'/)
      assert.match(homeSource, /import \{ createHtmlResponse \} from 'remix\/response\/html'/)
      assert.match(homeSource, /let page = <HomePage \/>/)
      assert.match(homeSource, /return createHtmlResponse\(renderToStream\(page\)\)/)
      assert.match(homeSource, /function HomePage\(\) \{/)
      assert.match(homeSource, /<h1>Home<\/h1>/)
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('accepts the global no-color flag', async () => {
    let result = runDoctorCommand(['--no-color'], getFixturePath('doctor-missing'))

    assert.equal(result.status, 0, result.stderr)
    assert.doesNotMatch(result.stdout, /\u001B\[/)
    assert.equal(result.stderr, '')
  })

  it('reports duplicate owner files for actions and controllers', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-duplicate-owner'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✗ controllers/)
    assert.match(
      result.stdout,
      /• \[WARN\] Route "home" has multiple action files: app\/controllers\/home\.ts, app\/controllers\/home\.tsx\. Keep only one action owner file\./,
    )
    assert.match(
      result.stdout,
      /• \[WARN\] Route "contact" has multiple controller files: app\/controllers\/contact\/controller\.ts, app\/controllers\/contact\/controller\.jsx\. Keep only one controller owner file\./,
    )
    assert.equal(result.stderr, '')
  })

  it('reports incomplete controllers when a controller folder is missing its entry file', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-incomplete-controller'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✗ controllers/)
    assert.match(
      result.stdout,
      /• \[WARN\] Route "contact" has files under app\/controllers\/contact, but is missing controller app\/controllers\/contact\/controller\.tsx\./,
    )
    assert.doesNotMatch(result.stdout, /Route "contact" is missing controller/)
    assert.equal(result.stderr, '')
  })

  it('creates a typed controller placeholder for incomplete controllers from local tsx evidence', async () => {
    let projectDir = await copyFixtureProject('doctor-incomplete-controller')

    try {
      let fixResult = runDoctorCommand(['--fix'], projectDir)

      assert.equal(fixResult.status, 0, fixResult.stderr)
      assert.match(fixResult.stdout, /✓ controllers/)
      assert.match(fixResult.stdout, /Created app\/controllers\/contact\/controller\.tsx/)
      assert.equal(fixResult.stderr, '')

      let contactSource = await fs.readFile(
        path.join(projectDir, 'app', 'controllers', 'contact', 'controller.tsx'),
        'utf8',
      )

      assert.match(contactSource, /import type \{ Controller \} from 'remix\/fetch-router'/)
      assert.match(contactSource, /import type \{ routes \} from '\.\.\/\.\.\/routes\.ts'/)
      assert.match(contactSource, /export default \{/)
      assert.match(contactSource, /\} satisfies Controller<typeof routes\.contact>/)

      let checkResult = runDoctorCommand([], projectDir)

      assert.equal(checkResult.status, 0, checkResult.stderr)
      assert.match(checkResult.stdout, /Doctor found no issues\./)
      assert.equal(checkResult.stderr, '')
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('reports wrong owner kinds for actions and controller folders', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-wrong-kind'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✗ controllers/)
    assert.match(
      result.stdout,
      /• \[WARN\] Route "home" expects action app\/controllers\/home\.tsx, but found controller app\/controllers\/home\/controller\.js\./,
    )
    assert.match(
      result.stdout,
      /• \[WARN\] Route "contact" expects controller app\/controllers\/contact\/controller\.tsx, but found standalone action app\/controllers\/contact\.ts\./,
    )
    assert.equal(result.stderr, '')
  })

  it('creates expected owner files for wrong owner kinds without removing existing files', async () => {
    let projectDir = await copyFixtureProject('doctor-wrong-kind')

    try {
      let result = runDoctorCommand(['--fix'], projectDir)

      assert.equal(result.status, 1)
      assert.match(result.stdout, /Applied fixes:/)
      assert.match(result.stdout, /Created app\/controllers\/home\.js/)
      assert.match(result.stdout, /Created app\/controllers\/contact\/controller\.ts/)
      assert.match(
        result.stdout,
        /Route "home" has both action app\/controllers\/home\.js and controller app\/controllers\/home\/controller\.js\./,
      )
      assert.match(
        result.stdout,
        /Route "contact" has both controller app\/controllers\/contact\/controller\.ts and standalone action app\/controllers\/contact\.ts\./,
      )
      assert.match(result.stdout, /Applied 2 fixes\./)
      assert.doesNotMatch(result.stdout, /Doctor found no issues\./)
      assert.equal(result.stderr, '')
      await assertPathExists(path.join(projectDir, 'app', 'controllers', 'home.js'))
      await assertPathExists(path.join(projectDir, 'app', 'controllers', 'home', 'controller.js'))
      await assertPathExists(path.join(projectDir, 'app', 'controllers', 'contact.ts'))
      await assertPathExists(
        path.join(projectDir, 'app', 'controllers', 'contact', 'controller.ts'),
      )
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('reports promotion drift for standalone actions that also have route-local files', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-promotion-drift'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✗ controllers/)
    assert.match(
      result.stdout,
      /• \[WARN\] Route "home" uses action app\/controllers\/home\.js, but also has files under app\/controllers\/home\. Promote it to controller app\/controllers\/home\/controller\.tsx or keep the route in app\/controllers\/home\.js\./,
    )
    assert.equal(result.stderr, '')
  })

  it('reports ambiguous owner mappings', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-ambiguous'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✗ controllers/)
    assert.match(
      result.stdout,
      /• \[WARN\] Route "home" has both action app\/controllers\/home\.js and controller app\/controllers\/home\/controller\.ts\./,
    )
    assert.match(
      result.stdout,
      /• \[WARN\] Route "contact" has both controller app\/controllers\/contact\/controller\.jsx and standalone action app\/controllers\/contact\.ts\./,
    )
    assert.equal(result.stderr, '')
  })

  it('reports orphan actions and controller folders', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-orphans'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✗ controllers/)
    assert.match(
      result.stdout,
      /• \[WARN\] Standalone action app\/controllers\/about\.jsx does not match any top-level route\./,
    )
    assert.match(
      result.stdout,
      /• \[WARN\] Controller app\/controllers\/unused\/controller\.js does not match any route group\./,
    )
    assert.equal(result.stderr, '')
  })

  it('reports extraneous route directories outside any controller route', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-orphan-route-local-file'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✗ controllers/)
    assert.match(
      result.stdout,
      /• \[WARN\] Directory app\/controllers\/unused does not match any route subtree\./,
    )
    assert.equal(result.stderr, '')
  })

  it('reports extraneous route directories from the controller tree shape', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-generic-buckets'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✗ controllers/)
    assert.match(
      result.stdout,
      /• \[WARN\] Directory app\/controllers\/components does not match any route subtree\./,
    )
    assert.match(
      result.stdout,
      /• \[WARN\] Standalone action app\/controllers\/helpers\.js does not match any top-level route\./,
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
    assert.match(result.stdout, /✓ controllers/)
    assert.doesNotMatch(result.stdout, /shared-bucket/)
    assert.equal(result.stderr, '')
  })

  it('uses kebab-case controller paths for camelCase route keys', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-camel-case-keys'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✓ controllers/)
    assert.doesNotMatch(result.stdout, /forgotPassword/)
    assert.doesNotMatch(result.stdout, /resetPassword/)
    assert.equal(result.stderr, '')
  })

  it('creates nested controller placeholders with kebab-case paths and camelCase actions', async () => {
    let projectDir = await createTempProject(
      {
        'app/routes.ts': [
          "import { form, route } from 'remix/fetch-router/routes'",
          '',
          'export const routes = route({',
          '  auth: {',
          "    forgotPassword: form('forgot-password'),",
          "    resetPassword: form('reset-password/:token'),",
          '  },',
          '})',
        ].join('\n'),
        'package.json': JSON.stringify(
          {
            dependencies: {
              remix: 'workspace:*',
            },
            engines: {
              node: '>=24.3.0',
            },
            name: 'doctor-fix-nested-fixture',
            private: true,
            type: 'module',
          },
          null,
          2,
        ),
        'tsconfig.json': JSON.stringify(
          {
            compilerOptions: {
              jsx: 'react-jsx',
            },
          },
          null,
          2,
        ),
      },
      { linkRemix: true },
    )

    try {
      let fixResult = runDoctorCommand(['--fix'], projectDir)

      assert.equal(fixResult.status, 0, fixResult.stderr)
      assert.match(fixResult.stdout, /✓ controllers/)
      assert.match(fixResult.stdout, /Created app\/controllers\/auth\/controller\.tsx/)
      assert.match(
        fixResult.stdout,
        /Created app\/controllers\/auth\/forgot-password\/controller\.tsx/,
      )
      assert.match(
        fixResult.stdout,
        /Created app\/controllers\/auth\/reset-password\/controller\.tsx/,
      )
      assert.equal(fixResult.stderr, '')

      let authSource = await fs.readFile(
        path.join(projectDir, 'app', 'controllers', 'auth', 'controller.tsx'),
        'utf8',
      )
      let forgotPasswordSource = await fs.readFile(
        path.join(projectDir, 'app', 'controllers', 'auth', 'forgot-password', 'controller.tsx'),
        'utf8',
      )

      assert.match(
        authSource,
        /import forgotPasswordController from '\.\/forgot-password\/controller\.tsx'/,
      )
      assert.match(
        authSource,
        /import resetPasswordController from '\.\/reset-password\/controller\.tsx'/,
      )
      assert.match(authSource, /forgotPassword: forgotPasswordController/)
      assert.match(authSource, /resetPassword: resetPasswordController/)
      assert.match(forgotPasswordSource, /TODO: implement routes\.auth\.forgotPassword\.index/)
      assert.match(forgotPasswordSource, /TODO: implement routes\.auth\.forgotPassword\.action/)

      let checkResult = runDoctorCommand([], projectDir)

      assert.equal(checkResult.status, 0, checkResult.stderr)
      assert.match(checkResult.stdout, /Doctor found no issues\./)
      assert.equal(checkResult.stderr, '')
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('prefers existing ts owner files when inferring missing action extensions', async () => {
    let projectDir = await createTempProject(
      {
        'app/controllers/about.ts': 'export {}\n',
        'app/routes.ts': [
          "import { route } from 'remix/fetch-router/routes'",
          '',
          'export const routes = route({',
          "  home: '/',",
          "  about: '/about',",
          '})',
        ].join('\n'),
        'package.json': JSON.stringify(
          {
            dependencies: {
              remix: 'workspace:*',
            },
            engines: {
              node: '>=24.3.0',
            },
            name: 'doctor-fix-ts-fixture',
            private: true,
            type: 'module',
          },
          null,
          2,
        ),
      },
      { linkRemix: true },
    )

    try {
      let result = runDoctorCommand(['--fix'], projectDir)

      assert.equal(result.status, 0, result.stderr)
      assert.match(result.stdout, /✓ controllers/)
      assert.match(result.stdout, /Created app\/controllers\/home\.ts/)
      assert.equal(result.stderr, '')
      await assertPathExists(path.join(projectDir, 'app', 'controllers', 'home.ts'))
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('prefers existing jsx owner files when inferring missing action extensions', async () => {
    let projectDir = await createTempProject(
      {
        'app/controllers/about.jsx': 'export {}\n',
        'app/routes.ts': [
          "import { route } from 'remix/fetch-router/routes'",
          '',
          'export const routes = route({',
          "  home: '/',",
          "  about: '/about',",
          '})',
        ].join('\n'),
        'package.json': JSON.stringify(
          {
            dependencies: {
              remix: 'workspace:*',
            },
            engines: {
              node: '>=24.3.0',
            },
            name: 'doctor-fix-jsx-fixture',
            private: true,
            type: 'module',
          },
          null,
          2,
        ),
      },
      { linkRemix: true },
    )

    try {
      let result = runDoctorCommand(['--fix'], projectDir)

      assert.equal(result.status, 0, result.stderr)
      assert.match(result.stdout, /✓ controllers/)
      assert.match(result.stdout, /Created app\/controllers\/home\.jsx/)
      assert.equal(result.stderr, '')
      await assertPathExists(path.join(projectDir, 'app', 'controllers', 'home.jsx'))
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('reports project warnings when routes is not exported', async () => {
    let result = runDoctorCommand([], getFixturePath('routes-no-export'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✗ project/)
    assert.match(result.stdout, /• controllers \(skipped: Blocked by project warnings\.\)/)
    assert.match(
      result.stdout,
      /✗ project\n  • \[WARN\] app\/routes\.ts must export a named "routes" value\./,
    )
    assert.equal(result.stderr, '')
  })

  it('reports project warnings when the route map is invalid', async () => {
    let result = runDoctorCommand([], getFixturePath('routes-invalid-value'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✗ project/)
    assert.match(result.stdout, /• controllers \(skipped: Blocked by project warnings\.\)/)
    assert.match(result.stdout, /✗ project\n  • \[WARN\] Invalid route map value at "broken"/)
    assert.equal(result.stderr, '')
  })

  it('reports project warnings when importing routes throws', async () => {
    let result = runDoctorCommand([], getFixturePath('routes-import-error'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✗ project/)
    assert.match(result.stdout, /• controllers \(skipped: Blocked by project warnings\.\)/)
    assert.match(
      result.stdout,
      /✗ project\n  • \[WARN\] Failed to load app\/routes\.ts: boom from routes fixture/,
    )
    assert.equal(result.stderr, '')
  })

  it('prints machine-readable findings as json', async () => {
    let fixtureDir = getFixturePath('doctor-wrong-kind')
    let result = runDoctorCommand(['--json'], fixtureDir)

    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stderr, '')

    let payload = JSON.parse(result.stdout) as DoctorReport
    let environmentSuite = payload.suites.find((suite) => suite.name === 'environment')
    let projectSuite = payload.suites.find((suite) => suite.name === 'project')
    let controllersSuite = payload.suites.find((suite) => suite.name === 'controllers')
    let home = controllersSuite?.findings.find((finding) => finding.routeName === 'home')
    let contact = controllersSuite?.findings.find((finding) => finding.routeName === 'contact')

    assert.equal(payload.appRoot, fixtureDir)
    assert.equal(payload.routesFile, path.join(fixtureDir, 'app', 'routes.ts'))
    assert.equal(payload.findings.length, 2)
    assert.equal(environmentSuite?.status, 'ok')
    assert.equal(projectSuite?.status, 'ok')
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

  it('prints applied fixes and remaining findings as json', async () => {
    let projectDir = await copyFixtureProject('doctor-missing')

    try {
      let result = runDoctorCommand(['--fix', '--json'], projectDir)

      assert.equal(result.status, 0, result.stderr)
      assert.equal(result.stderr, '')

      let payload = JSON.parse(result.stdout) as DoctorReport

      assert.equal(payload.findings.length, 0)
      assert.equal(payload.remainingFindings?.length, 0)
      assert.equal(payload.appliedFixes?.length, 2)
      assert.equal(payload.suites.find((suite) => suite.name === 'controllers')?.status, 'ok')
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('prints skipped suites as json when project blocks controllers', async () => {
    let fixtureDir = getFixturePath('routes-no-export')
    let result = runDoctorCommand(['--json'], fixtureDir)

    assert.equal(result.status, 0, result.stderr)

    let payload = JSON.parse(result.stdout) as DoctorReport
    let projectSuite = payload.suites.find((suite) => suite.name === 'project')
    let controllersSuite = payload.suites.find((suite) => suite.name === 'controllers')

    assert.equal(projectSuite?.status, 'issues')
    assert.equal(controllersSuite?.status, 'skipped')
    assert.equal(controllersSuite?.reason, 'Blocked by project warnings.')
  })

  it('fails strict mode when controller warnings are present', async () => {
    let result = runDoctorCommand(['--strict'], getFixturePath('doctor-wrong-kind'))

    assert.equal(result.status, 1)
    assert.match(result.stdout, /Summary: 2 warnings, 0 advice\./)
    assert.match(result.stdout, /✗ controllers/)
    assert.equal(result.stderr, '')
  })

  it('fails strict mode when project warnings are present', async () => {
    let result = runDoctorCommand(['--strict'], getFixturePath('routes-no-export'))

    assert.equal(result.status, 1)
    assert.match(result.stdout, /must export a named "routes" value/)
    assert.match(result.stdout, /✗ project/)
    assert.equal(result.stderr, '')
  })
})

function runDoctorCommand(args: string[], cwd: string) {
  return spawnSync(process.execPath, [CLI_ENTRY_PATH, 'doctor', ...args], {
    cwd,
    encoding: 'utf8',
  })
}

async function copyFixtureProject(name: string): Promise<string> {
  let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), `remix-${name}-`))
  await fs.cp(getFixturePath(name), projectDir, { recursive: true })
  return projectDir
}

async function createTempProject(
  files: Record<string, string>,
  options: { linkRemix?: boolean } = {},
): Promise<string> {
  let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-doctor-'))

  for (let [filePath, contents] of Object.entries(files)) {
    let absolutePath = path.join(projectDir, filePath)
    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    await fs.writeFile(absolutePath, `${contents}\n`, 'utf8')
  }

  if (options.linkRemix) {
    await linkRemix(projectDir)
  }

  return projectDir
}

async function linkRemix(projectDir: string): Promise<void> {
  await fs.mkdir(path.join(projectDir, 'node_modules'), { recursive: true })
  await fs.symlink(
    path.join(ROOT_DIR, 'packages', 'remix'),
    path.join(projectDir, 'node_modules', 'remix'),
  )
}

function getSupportedNodeRangeCases(): Array<{ label: string; range: string }> {
  let [major, minor, patch] = process.versions.node.split('.').map(Number)

  return [
    { label: 'caret', range: `^${major}.${minor}.${patch}` },
    { label: 'tilde', range: `~${major}.${minor}.${patch}` },
    { label: 'x-range', range: `${major}.x` },
  ]
}

async function assertPathExists(filePath: string): Promise<void> {
  await fs.access(filePath)
}

async function assertPathMissing(filePath: string): Promise<void> {
  await assert.rejects(() => fs.access(filePath))
}

interface DoctorReport {
  appliedFixes?: DoctorAppliedFix[]
  appRoot?: string
  findings: DoctorFinding[]
  remainingFindings?: DoctorFinding[]
  routesFile?: string
  suites: DoctorSuite[]
}

interface DoctorSuite {
  appliedFixes?: DoctorAppliedFix[]
  findings: DoctorFinding[]
  name: 'controllers' | 'environment' | 'project'
  reason?: string
  status: 'issues' | 'ok' | 'skipped'
}

interface DoctorAppliedFix {
  code:
    | 'incomplete-controller'
    | 'missing-owner'
    | 'node-engine-missing'
    | 'node-engine-unparseable'
    | 'node-version-unsupported'
    | 'remix-dependency-missing'
    | 'routes-file-missing'
    | 'routes-export-missing'
    | 'wrong-owner-kind'
  kind: 'create-directory' | 'create-file' | 'update-file'
  path: string
  routeName?: string
  suite: 'controllers' | 'environment' | 'project'
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
  suite: 'controllers' | 'environment' | 'project'
}
