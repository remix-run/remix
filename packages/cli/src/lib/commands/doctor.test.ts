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
  '  --fix     Apply low-risk project and action fixes',
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
    let result = await runDoctor(['--help'], ROOT_DIR)

    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout, DOCTOR_COMMAND_HELP_TEXT)
    assert.equal(result.stderr, '')
  })

  it('works from a nested directory inside an app', async () => {
    let nestedDir = path.join(getFixturePath('doctor-clean'), 'app', 'actions', 'contact')
    let result = await runDoctor([], nestedDir)

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✓ environment/)
    assert.match(result.stdout, /✓ project/)
    assert.match(result.stdout, /✓ actions/)
    assert.match(result.stdout, /Doctor found no issues\./)
    assert.equal(result.stderr, '')
  })

  it('reports no findings for a clean fixture', async () => {
    let result = await runDoctor([], getFixturePath('doctor-clean'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(
      result.stdout,
      /\n• Checking environment\.\.\.\n✓ environment\n\n• Checking project\.\.\.\n✓ project\n\n• Checking actions\.\.\.\n✓ actions\n\nDoctor found no issues\.\nSummary: 0 warnings, 0 advice\.\n\n$/,
    )
    assert.equal(result.stderr, '')
  })

  it('does not require a root action controller when the root route map has no direct leaves', async () => {
    let projectDir = await createTempProject(
      {
        'app/actions/auth/controller.ts': 'export default {}',
        'app/actions/main/controller.ts': 'export default {}',
        'app/routes.ts': [
          "import { get, route } from 'remix/routes'",
          '',
          'export const routes = {',
          "  main: route('/', {",
          "    index: get('/'),",
          '  }),',
          "  auth: route('auth', {",
          "    login: get('login'),",
          '  }),',
          '}',
        ].join('\n'),
        'package.json': JSON.stringify(
          {
            dependencies: {
              remix: 'workspace:*',
            },
            engines: {
              node: '>=24.3.0',
            },
            name: 'doctor-nested-root-fixture',
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
      let result = await runDoctor([], projectDir)

      assert.equal(result.status, 0, result.stderr)
      assert.match(result.stdout, /✓ actions/)
      assert.match(result.stdout, /Doctor found no issues\./)
      assert.doesNotMatch(result.stdout, /Root route map is missing action controller/)
      assert.equal(result.stderr, '')
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('applies no fixes for a clean fixture', async () => {
    let result = await runDoctor(['--fix'], getFixturePath('doctor-clean'))

    assert.equal(result.status, 0, result.stderr)
    assert.doesNotMatch(result.stdout, /Applied fixes:/)
    assert.match(result.stdout, /Doctor found no issues\./)
    assert.match(result.stdout, /✓ actions/)
    assert.equal(result.stderr, '')
  })

  it('does not print color when output is not a tty', async () => {
    let result = await runDoctor([], getFixturePath('doctor-missing'))

    assert.equal(result.status, 0, result.stderr)
    assert.doesNotMatch(result.stdout, /\u001B\[/)
    assert.equal(result.stderr, '')
  })

  it('marks advice-only suites as passing while still printing the advice', async () => {
    let projectDir = await createTempProject(
      {
        'app/actions/controller.js': [
          'export default {',
          '  actions: {',
          '    home() {',
          "      return new Response('ok')",
          '    },',
          '  },',
          '}',
        ].join('\n'),
        'app/routes.ts': [
          "import { route } from 'remix/routes'",
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
      let result = await runDoctor([], projectDir)

      assert.equal(result.status, 0, result.stderr)
      assert.match(result.stdout, /✓ environment/)
      assert.doesNotMatch(result.stdout, /✗ environment/)
      assert.match(
        result.stdout,
        /✓ environment\n  • \[ADVICE\] package\.json does not declare engines\.node\. Add one to document the supported Node\.js version\./,
      )
      assert.match(result.stdout, /✓ project/)
      assert.match(result.stdout, /✓ actions/)
      assert.match(result.stdout, /Summary: 0 warnings, 1 advice\./)
      assert.equal(result.stderr, '')
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('reports environment warnings and skips later suites when package.json is missing', async () => {
    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-doctor-no-package-'))

    try {
      let result = await runDoctor([], tmpDir)

      assert.equal(result.status, 0, result.stderr)
      assert.match(result.stdout, /✗ environment/)
      assert.match(result.stdout, /• project \(skipped: Blocked by environment warnings\.\)/)
      assert.match(result.stdout, /• actions \(skipped: Blocked by environment warnings\.\)/)
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
      let result = await runDoctor([], tmpDir)

      assert.equal(result.status, 0, result.stderr)
      assert.match(result.stdout, /✗ environment/)
      assert.match(result.stdout, /• project \(skipped: Blocked by environment warnings\.\)/)
      assert.match(result.stdout, /• actions \(skipped: Blocked by environment warnings\.\)/)
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

      let result = await runDoctor([], tmpDir)

      assert.equal(result.status, 0, result.stderr)
      assert.match(result.stdout, /✗ environment/)
      assert.match(
        result.stdout,
        /✗ environment\n  • \[WARN\] Project requires Node\.js >=99\.0\.0, but the current runtime is v\d+\.\d+\.\d+\./,
      )
      assert.match(result.stdout, /• project \(skipped: Blocked by environment warnings\.\)/)
      assert.match(result.stdout, /• actions \(skipped: Blocked by environment warnings\.\)/)
      assert.equal(result.stderr, '')
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('accepts standard npm semver range syntax for engines.node', async () => {
    for (let { label, range } of getSupportedNodeRangeCases()) {
      let projectDir = await createTempProject(
        {
          'app/actions/controller.js': [
            'export default {',
            '  actions: {',
            '    home() {',
            "      return new Response('ok')",
            '    },',
            '  },',
            '}',
          ].join('\n'),
          'app/routes.ts': [
            "import { route } from 'remix/routes'",
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
        let checkResult = await runDoctor([], projectDir)

        assert.equal(checkResult.status, 0, `${label}: ${checkResult.stderr}`)
        assert.match(checkResult.stdout, /Doctor found no issues\./, label)
        assert.equal(checkResult.stderr, '', label)

        let fixResult = await runDoctor(['--fix'], projectDir)

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
    let result = await runDoctor([], getFixturePath('doctor-env-missing-remix-dependency'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✗ environment/)
    assert.match(result.stdout, /• project \(skipped: Blocked by environment warnings\.\)/)
    assert.match(result.stdout, /• actions \(skipped: Blocked by environment warnings\.\)/)
    assert.match(
      result.stdout,
      /✗ environment\n  • \[WARN\] package\.json does not declare a remix dependency\./,
    )
    assert.equal(result.stderr, '')
  })

  it('updates package.json with supported engines.node and a remix dependency', async () => {
    let projectDir = await createTempProject(
      {
        'app/actions/controller.js': [
          'export default {',
          '  actions: {',
          '    home() {',
          "      return new Response('ok')",
          '    },',
          '  },',
          '}',
        ].join('\n'),
        'app/routes.ts': [
          "import { route } from 'remix/routes'",
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
      let fixResult = await runDoctor(['--fix'], projectDir)

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

      let checkResult = await runDoctor([], projectDir)

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
      let result = await runDoctor([], tmpDir)

      assert.equal(result.status, 0, result.stderr)
      assert.match(result.stdout, /✗ environment/)
      assert.match(result.stdout, /• project \(skipped: Blocked by environment warnings\.\)/)
      assert.match(result.stdout, /• actions \(skipped: Blocked by environment warnings\.\)/)
      assert.match(
        result.stdout,
        /✗ environment\n  • \[WARN\] Could not resolve remix from this project\./,
      )
      assert.equal(result.stderr, '')
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('reports missing app routes files and skips actions', async () => {
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

      let result = await runDoctor([], tmpDir)

      assert.equal(result.status, 0, result.stderr)
      assert.match(result.stdout, /✓ environment/)
      assert.match(result.stdout, /✗ project/)
      assert.match(result.stdout, /• actions \(skipped: Blocked by project warnings\.\)/)
      assert.match(result.stdout, /✗ project\n  • \[WARN\] Project is missing app\/routes\.ts\./)
      assert.equal(result.stderr, '')
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('updates unsupported engines.node to the supported floor', async () => {
    let projectDir = await createTempProject(
      {
        'app/actions/controller.js': [
          'export default {',
          '  actions: {',
          '    home() {',
          "      return new Response('ok')",
          '    },',
          '  },',
          '}',
        ].join('\n'),
        'app/routes.ts': [
          "import { route } from 'remix/routes'",
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
      let fixResult = await runDoctor(['--fix'], projectDir)

      assert.equal(fixResult.status, 0, fixResult.stderr)
      assert.match(fixResult.stdout, /Updated package\.json/)
      assert.equal(fixResult.stderr, '')

      let packageJson = JSON.parse(
        await fs.readFile(path.join(projectDir, 'package.json'), 'utf8'),
      ) as {
        engines: Record<string, string>
      }

      assert.equal(packageJson.engines.node, '>=24.3.0')

      let checkResult = await runDoctor([], projectDir)

      assert.equal(checkResult.status, 0, checkResult.stderr)
      assert.match(checkResult.stdout, /Doctor found no issues\./)
      assert.equal(checkResult.stderr, '')
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('reports missing action controllers', async () => {
    let result = await runDoctor([], getFixturePath('doctor-missing'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✗ actions/)
    assert.match(
      result.stdout,
      /✗ actions\n  • \[WARN\] Root route map is missing action controller app\/actions\/controller\.tsx\./,
    )
    assert.match(
      result.stdout,
      /• \[WARN\] Route map "contact" is missing action controller app\/actions\/contact\/controller\.tsx\./,
    )
    assert.match(result.stdout, /controller\.tsx\.\n\nSummary: 2 warnings, 0 advice\./)
    assert.equal(result.stderr, '')
  })

  it('creates app/routes.ts and a default root action controller when routes are missing', async () => {
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
      let fixResult = await runDoctor(['--fix'], projectDir)

      assert.equal(fixResult.status, 0, fixResult.stderr)
      assert.match(fixResult.stdout, /✓ project/)
      assert.match(fixResult.stdout, /✓ project\n  Applied fixes:/)
      assert.match(fixResult.stdout, /Created app\/routes\.ts/)
      assert.match(fixResult.stdout, /Created app\/actions\/controller\.js/)
      assert.equal(fixResult.stderr, '')

      let routesSource = await fs.readFile(path.join(projectDir, 'app', 'routes.ts'), 'utf8')
      let controllerSource = await fs.readFile(
        path.join(projectDir, 'app', 'actions', 'controller.js'),
        'utf8',
      )

      assert.match(routesSource, /export const routes = route\(\{/)
      assert.match(routesSource, /home: '\//)
      assert.match(controllerSource, /import \{ html \} from 'remix\/html-template'/)
      assert.match(controllerSource, /import \{ createHtmlResponse \} from 'remix\/response\/html'/)
      assert.match(controllerSource, /export default \{/)
      assert.match(controllerSource, /actions: \{/)
      assert.match(controllerSource, /home\(\) \{\n\s+let page = html`/)
      assert.match(controllerSource, /return createHtmlResponse\(page\)/)
      assert.match(controllerSource, /<h1>Home<\/h1>/)

      let checkResult = await runDoctor([], projectDir)

      assert.equal(checkResult.status, 0, checkResult.stderr)
      assert.match(checkResult.stdout, /Doctor found no issues\./)
      assert.equal(checkResult.stderr, '')
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('replaces comment-only app/routes.ts and creates a default root action controller', async () => {
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
      let fixResult = await runDoctor(['--fix'], projectDir)

      assert.equal(fixResult.status, 0, fixResult.stderr)
      assert.match(fixResult.stdout, /✓ project/)
      assert.match(fixResult.stdout, /Updated app\/routes\.ts/)
      assert.match(fixResult.stdout, /Created app\/actions\/controller\.js/)
      assert.equal(fixResult.stderr, '')

      let routesSource = await fs.readFile(path.join(projectDir, 'app', 'routes.ts'), 'utf8')
      let controllerSource = await fs.readFile(
        path.join(projectDir, 'app', 'actions', 'controller.js'),
        'utf8',
      )

      assert.match(routesSource, /export const routes = route\(\{/)
      assert.match(routesSource, /home: '\//)
      assert.match(controllerSource, /export default \{/)
      assert.match(controllerSource, /home\(\) \{/)

      let checkResult = await runDoctor([], projectDir)

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
      let fixResult = await runDoctor(['--fix'], projectDir)

      assert.equal(fixResult.status, 0, fixResult.stderr)
      assert.match(fixResult.stdout, /✓ actions/)
      assert.match(fixResult.stdout, /Applied fixes:/)
      assert.match(fixResult.stdout, /Created app\/actions\/controller\.js/)
      assert.match(fixResult.stdout, /Created app\/actions\/contact\/controller\.js/)
      assert.match(fixResult.stdout, /Applied 2 fixes\./)
      assert.match(fixResult.stdout, /Doctor found no issues\./)
      assert.equal(fixResult.stderr, '')

      let controllerSource = await fs.readFile(
        path.join(projectDir, 'app', 'actions', 'controller.js'),
        'utf8',
      )
      let contactSource = await fs.readFile(
        path.join(projectDir, 'app', 'actions', 'contact', 'controller.js'),
        'utf8',
      )

      assert.match(controllerSource, /export default \{/)
      assert.match(controllerSource, /home\(\) \{/)
      assert.match(controllerSource, /TODO: implement routes\.home/)
      assert.match(contactSource, /export default \{/)
      assert.match(contactSource, /index\(\) \{/)
      assert.match(contactSource, /action\(\) \{/)
      assert.match(contactSource, /TODO: implement routes\.contact\.index/)
      assert.match(contactSource, /TODO: implement routes\.contact\.action/)

      let checkResult = await runDoctor([], projectDir)

      assert.equal(checkResult.status, 0, checkResult.stderr)
      assert.match(checkResult.stdout, /Doctor found no issues\./)
      assert.equal(checkResult.stderr, '')
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('creates safe placeholder action keys for non-identifier route keys', async () => {
    let projectDir = await createTempProject(
      {
        'app/routes.ts': [
          "import { route } from 'remix/routes'",
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
      let fixResult = await runDoctor(['--fix'], projectDir)

      assert.equal(fixResult.status, 0, fixResult.stderr)
      assert.match(fixResult.stdout, /Created app\/actions\/controller\.js/)

      let controllerSource = await fs.readFile(
        path.join(projectDir, 'app', 'actions', 'controller.js'),
        'utf8',
      )

      assert.match(controllerSource, /"sales-report"\(\) \{/)
      assert.match(controllerSource, /TODO: implement routes\.sales-report/)

      let checkResult = await runDoctor([], projectDir)

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
          "import { route } from 'remix/routes'",
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
      let fixResult = await runDoctor(['--fix'], projectDir)

      assert.equal(fixResult.status, 0, fixResult.stderr)
      assert.match(fixResult.stdout, /Created app\/actions\/controller\.js/)
      await assertPathExists(path.join(projectDir, 'app', 'actions', 'controller.js'))
      await assertPathMissing(outsidePath)

      let checkResult = await runDoctor([], projectDir)

      assert.equal(checkResult.status, 0, checkResult.stderr)
      assert.match(checkResult.stdout, /Doctor found no issues\./)
      assert.equal(checkResult.stderr, '')
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('creates a jsx root action controller placeholder when the project uses tsx', async () => {
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
      let fixResult = await runDoctor(['--fix'], projectDir)

      assert.equal(fixResult.status, 0, fixResult.stderr)
      assert.match(fixResult.stdout, /Created app\/actions\/controller\.tsx/)

      let controllerSource = await fs.readFile(
        path.join(projectDir, 'app', 'actions', 'controller.tsx'),
        'utf8',
      )

      assert.match(controllerSource, /import \{ renderToStream \} from 'remix\/ui\/server'/)
      assert.match(controllerSource, /import \{ createHtmlResponse \} from 'remix\/response\/html'/)
      assert.match(controllerSource, /let page = <HomePage \/>/)
      assert.match(controllerSource, /return createHtmlResponse\(renderToStream\(page\)\)/)
      assert.match(controllerSource, /function HomePage\(\) \{/)
      assert.match(controllerSource, /<h1>Home<\/h1>/)
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('accepts the global no-color flag', async () => {
    let result = await runDoctor(['--no-color'], getFixturePath('doctor-missing'))

    assert.equal(result.status, 0, result.stderr)
    assert.doesNotMatch(result.stdout, /\u001B\[/)
    assert.equal(result.stderr, '')
  })

  it('reports duplicate action controller files', async () => {
    let result = await runDoctor([], getFixturePath('doctor-duplicate-owner'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✗ actions/)
    assert.match(
      result.stdout,
      /• \[WARN\] Root route map has multiple action controller files: app\/actions\/controller\.ts, app\/actions\/controller\.tsx\. Keep only one controller owner file\./,
    )
    assert.match(
      result.stdout,
      /• \[WARN\] Route map "contact" has multiple action controller files: app\/actions\/contact\/controller\.ts, app\/actions\/contact\/controller\.jsx\. Keep only one controller owner file\./,
    )
    assert.equal(result.stderr, '')
  })

  it('reports incomplete actions when a route-key folder is missing its entry file', async () => {
    let result = await runDoctor([], getFixturePath('doctor-incomplete-controller'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✗ actions/)
    assert.match(
      result.stdout,
      /• \[WARN\] Route map "contact" has files under app\/actions\/contact, but is missing action controller app\/actions\/contact\/controller\.tsx\./,
    )
    assert.doesNotMatch(result.stdout, /Route map "contact" is missing action controller/)
    assert.equal(result.stderr, '')
  })

  it('creates a typed controller placeholder for incomplete actions from local tsx evidence', async () => {
    let projectDir = await copyFixtureProject('doctor-incomplete-controller')

    try {
      let fixResult = await runDoctor(['--fix'], projectDir)

      assert.equal(fixResult.status, 0, fixResult.stderr)
      assert.match(fixResult.stdout, /✓ actions/)
      assert.match(fixResult.stdout, /Created app\/actions\/contact\/controller\.tsx/)
      assert.equal(fixResult.stderr, '')

      let contactSource = await fs.readFile(
        path.join(projectDir, 'app', 'actions', 'contact', 'controller.tsx'),
        'utf8',
      )

      assert.match(contactSource, /import type \{ Controller \} from 'remix\/fetch-router'/)
      assert.match(contactSource, /import type \{ routes \} from '\.\.\/\.\.\/routes\.ts'/)
      assert.match(contactSource, /export default \{/)
      assert.match(contactSource, /\} satisfies Controller<typeof routes\.contact>/)

      let checkResult = await runDoctor([], projectDir)

      assert.equal(checkResult.status, 0, checkResult.stderr)
      assert.match(checkResult.stdout, /Doctor found no issues\./)
      assert.equal(checkResult.stderr, '')
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('reports orphan action controller folders', async () => {
    let result = await runDoctor([], getFixturePath('doctor-orphans'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✗ actions/)
    assert.match(
      result.stdout,
      /• \[WARN\] Action controller app\/actions\/unused\/controller\.js does not match any route map\./,
    )
    assert.equal(result.stderr, '')
  })

  it('reports extraneous route directories outside any controller route', async () => {
    let result = await runDoctor([], getFixturePath('doctor-orphan-route-local-file'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✗ actions/)
    assert.match(
      result.stdout,
      /• \[WARN\] Directory app\/actions\/unused does not match any route-map key path\./,
    )
    assert.equal(result.stderr, '')
  })

  it('reports extraneous route directories from the route-map shape', async () => {
    let result = await runDoctor([], getFixturePath('doctor-generic-buckets'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✗ actions/)
    assert.match(
      result.stdout,
      /• \[WARN\] Directory app\/actions\/components does not match any route-map key path\./,
    )
    assert.doesNotMatch(
      result.stdout,
      /Route-local file app\/actions\/components\/example\.jsx does not live under any controller route\./,
    )
    assert.equal(result.stderr, '')
  })

  it('allows route names like shared and common when the route map declares them', async () => {
    let result = await runDoctor([], getFixturePath('doctor-route-names'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✓ actions/)
    assert.doesNotMatch(result.stdout, /shared-bucket/)
    assert.equal(result.stderr, '')
  })

  it('uses kebab-case controller paths for camelCase route keys', async () => {
    let result = await runDoctor([], getFixturePath('doctor-camel-case-keys'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✓ actions/)
    assert.doesNotMatch(result.stdout, /forgotPassword/)
    assert.doesNotMatch(result.stdout, /resetPassword/)
    assert.equal(result.stderr, '')
  })

  it('creates nested controller placeholders with kebab-case paths and camelCase actions', async () => {
    let projectDir = await createTempProject(
      {
        'app/routes.ts': [
          "import { form, route } from 'remix/routes'",
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
      let fixResult = await runDoctor(['--fix'], projectDir)

      assert.equal(fixResult.status, 0, fixResult.stderr)
      assert.match(fixResult.stdout, /✓ actions/)
      assert.match(fixResult.stdout, /Created app\/actions\/auth\/controller\.tsx/)
      assert.match(fixResult.stdout, /Created app\/actions\/auth\/forgot-password\/controller\.tsx/)
      assert.match(fixResult.stdout, /Created app\/actions\/auth\/reset-password\/controller\.tsx/)
      assert.doesNotMatch(fixResult.stdout, /Created app\/actions\/controller\.tsx/)
      assert.match(fixResult.stdout, /Applied 3 fixes\./)
      assert.equal(fixResult.stderr, '')

      let authSource = await fs.readFile(
        path.join(projectDir, 'app', 'actions', 'auth', 'controller.tsx'),
        'utf8',
      )
      let forgotPasswordSource = await fs.readFile(
        path.join(projectDir, 'app', 'actions', 'auth', 'forgot-password', 'controller.tsx'),
        'utf8',
      )

      assert.doesNotMatch(authSource, /forgotPasswordController/)
      assert.doesNotMatch(authSource, /resetPasswordController/)
      assert.match(authSource, /actions: \{\n  \}/)
      assert.match(forgotPasswordSource, /TODO: implement routes\.auth\.forgotPassword\.index/)
      assert.match(forgotPasswordSource, /TODO: implement routes\.auth\.forgotPassword\.action/)

      let checkResult = await runDoctor([], projectDir)

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
        'app/actions/contact/controller.ts': 'export {}\n',
        'app/routes.ts': [
          "import { route } from 'remix/routes'",
          '',
          'export const routes = route({',
          "  home: '/',",
          '  contact: {',
          "    index: '/contact',",
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
      let result = await runDoctor(['--fix'], projectDir)

      assert.equal(result.status, 0, result.stderr)
      assert.match(result.stdout, /✓ actions/)
      assert.match(result.stdout, /Created app\/actions\/controller\.ts/)
      assert.equal(result.stderr, '')
      await assertPathExists(path.join(projectDir, 'app', 'actions', 'controller.ts'))
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('prefers existing jsx owner files when inferring missing action extensions', async () => {
    let projectDir = await createTempProject(
      {
        'app/actions/contact/controller.jsx': 'export {}\n',
        'app/routes.ts': [
          "import { route } from 'remix/routes'",
          '',
          'export const routes = route({',
          "  home: '/',",
          '  contact: {',
          "    index: '/contact',",
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
      let result = await runDoctor(['--fix'], projectDir)

      assert.equal(result.status, 0, result.stderr)
      assert.match(result.stdout, /✓ actions/)
      assert.match(result.stdout, /Created app\/actions\/controller\.jsx/)
      assert.equal(result.stderr, '')
      await assertPathExists(path.join(projectDir, 'app', 'actions', 'controller.jsx'))
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('reports project warnings when routes is not exported', async () => {
    let result = await runDoctor([], getFixturePath('routes-no-export'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✗ project/)
    assert.match(result.stdout, /• actions \(skipped: Blocked by project warnings\.\)/)
    assert.match(
      result.stdout,
      /✗ project\n  • \[WARN\] app\/routes\.ts must export a named "routes" value\./,
    )
    assert.equal(result.stderr, '')
  })

  it('reports project warnings when the route map is invalid', async () => {
    let result = await runDoctor([], getFixturePath('routes-invalid-value'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✗ project/)
    assert.match(result.stdout, /• actions \(skipped: Blocked by project warnings\.\)/)
    assert.match(result.stdout, /✗ project\n  • \[WARN\] Invalid route map value at "broken"/)
    assert.equal(result.stderr, '')
  })

  it('reports project warnings when importing routes throws', async () => {
    let result = await runDoctor([], getFixturePath('routes-import-error'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✗ project/)
    assert.match(result.stdout, /• actions \(skipped: Blocked by project warnings\.\)/)
    assert.match(
      result.stdout,
      /✗ project\n  • \[WARN\] Failed to load app\/routes\.ts: boom from routes fixture/,
    )
    assert.equal(result.stderr, '')
  })

  it('prints machine-readable findings as json', async () => {
    let fixtureDir = getFixturePath('doctor-missing')
    let result = await runDoctor(['--json'], fixtureDir)

    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stderr, '')

    let payload = JSON.parse(result.stdout) as DoctorReport
    let environmentSuite = payload.suites.find((suite) => suite.name === 'environment')
    let projectSuite = payload.suites.find((suite) => suite.name === 'project')
    let actionsSuite = payload.suites.find((suite) => suite.name === 'actions')
    let root = actionsSuite?.findings.find((finding) => finding.routeName === '<root>')
    let contact = actionsSuite?.findings.find((finding) => finding.routeName === 'contact')

    assert.equal(payload.appRoot, fixtureDir)
    assert.equal(payload.routesFile, path.join(fixtureDir, 'app', 'routes.ts'))
    assert.equal(payload.findings.length, 2)
    assert.equal(environmentSuite?.status, 'ok')
    assert.equal(projectSuite?.status, 'ok')
    assert.equal(actionsSuite?.status, 'issues')
    assert.ok(root)
    assert.equal(root.code, 'missing-owner')
    assert.equal(root.expectedPath, 'app/actions/controller.tsx')
    assert.equal(root.actualPath, undefined)
    assert.ok(contact)
    assert.equal(contact.code, 'missing-owner')
    assert.equal(contact.expectedPath, 'app/actions/contact/controller.tsx')
    assert.equal(contact.actualPath, undefined)
  })

  it('prints applied fixes and remaining findings as json', async () => {
    let projectDir = await copyFixtureProject('doctor-missing')

    try {
      let result = await runDoctor(['--fix', '--json'], projectDir)

      assert.equal(result.status, 0, result.stderr)
      assert.equal(result.stderr, '')

      let payload = JSON.parse(result.stdout) as DoctorReport

      assert.equal(payload.findings.length, 0)
      assert.equal(payload.remainingFindings?.length, 0)
      assert.equal(payload.appliedFixes?.length, 2)
      assert.equal(payload.suites.find((suite) => suite.name === 'actions')?.status, 'ok')
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('prints skipped suites as json when project blocks actions', async () => {
    let fixtureDir = getFixturePath('routes-no-export')
    let result = await runDoctor(['--json'], fixtureDir)

    assert.equal(result.status, 0, result.stderr)

    let payload = JSON.parse(result.stdout) as DoctorReport
    let projectSuite = payload.suites.find((suite) => suite.name === 'project')
    let actionsSuite = payload.suites.find((suite) => suite.name === 'actions')

    assert.equal(projectSuite?.status, 'issues')
    assert.equal(actionsSuite?.status, 'skipped')
    assert.equal(actionsSuite?.reason, 'Blocked by project warnings.')
  })

  it('fails strict mode when action warnings are present', async () => {
    let result = await runDoctor(['--strict'], getFixturePath('doctor-missing'))

    assert.equal(result.status, 1)
    assert.match(result.stdout, /Summary: 2 warnings, 0 advice\./)
    assert.match(result.stdout, /✗ actions/)
    assert.equal(result.stderr, '')
  })

  it('fails strict mode when project warnings are present', async () => {
    let result = await runDoctor(['--strict'], getFixturePath('routes-no-export'))

    assert.equal(result.status, 1)
    assert.match(result.stdout, /must export a named "routes" value/)
    assert.match(result.stdout, /✗ project/)
    assert.equal(result.stderr, '')
  })
})

async function runDoctor(args: string[], cwd: string) {
  let remixVersion = await readRemixVersion()
  return await captureOutput(() => runRemix(['doctor', ...args], { cwd, remixVersion }))
}

async function readRemixVersion(): Promise<string> {
  let packageJson = JSON.parse(await fs.readFile(REMIX_PACKAGE_JSON_PATH, 'utf8')) as {
    version: string
  }
  return packageJson.version
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
  name: 'actions' | 'environment' | 'project'
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
  kind: 'create-directory' | 'create-file' | 'update-file'
  path: string
  routeName?: string
  suite: 'actions' | 'environment' | 'project'
}

interface DoctorFinding {
  actualPath?: string
  code:
    | 'duplicate-owner-file'
    | 'incomplete-controller'
    | 'missing-owner'
    | 'node-engine-missing'
    | 'node-engine-unparseable'
    | 'node-version-unsupported'
    | 'orphan-controller'
    | 'orphan-route-directory'
    | 'package-json-invalid'
    | 'package-json-read-failed'
    | 'project-root-not-found'
    | 'remix-dependency-missing'
    | 'remix-install-missing'
    | 'route-map-invalid'
    | 'route-map-invalid-json'
    | 'route-map-loader-signal'
    | 'route-module-import-failed'
    | 'routes-export-missing'
    | 'routes-file-missing'
  expectedPath?: string
  message: string
  routeName?: string
  severity: 'advice' | 'warn'
  suite: 'actions' | 'environment' | 'project'
}
