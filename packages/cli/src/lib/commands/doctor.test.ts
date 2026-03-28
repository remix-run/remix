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
    assert.match(
      result.stdout,
      /Usage:\s+remix doctor \[--json\] \[--strict\] \[--fix\] \[--no-color\]/,
    )
    assert.match(result.stdout, /Check project environment and Remix app conventions/)
    assert.match(result.stdout, /--fix\s+Apply low-risk project and controller fixes/)
    assert.equal(result.stderr, '')
  })

  it('works from a nested directory inside an app', async () => {
    let nestedDir = path.join(getFixturePath('doctor-clean'), 'app', 'controllers', 'contact')
    let result = runDoctorCommand([], nestedDir)

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stderr, /✓ environment/)
    assert.match(result.stderr, /✓ project/)
    assert.match(result.stderr, /✓ controllers/)
    assert.match(result.stdout, /Doctor found no issues\./)
  })

  it('reports no findings for a clean fixture', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-clean'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stderr, /✓ environment/)
    assert.match(result.stderr, /✓ project/)
    assert.match(result.stderr, /✓ controllers/)
    assert.match(
      result.stderr,
      /✓ environment\n\n• Checking project\.\.\.\n✓ project\n\n• Checking controllers\.\.\.\n✓ controllers\n\n$/,
    )
    assert.match(result.stdout, /Doctor found no issues\./)
    assert.match(result.stdout, /Summary: 0 warnings, 0 advice\./)
  })

  it('applies no fixes for a clean fixture', async () => {
    let result = runDoctorCommand(['--fix'], getFixturePath('doctor-clean'))

    assert.equal(result.status, 0, result.stderr)
    assert.doesNotMatch(result.stdout, /Applied fixes:/)
    assert.match(result.stdout, /Doctor found no issues\./)
    assert.match(result.stderr, /✓ controllers/)
  })

  it('does not print color when output is not a tty', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-missing'))

    assert.equal(result.status, 0, result.stderr)
    assert.doesNotMatch(result.stdout, /\u001B\[/)
    assert.doesNotMatch(result.stderr, /\u001B\[/)
  })

  it('reports environment warnings and skips later suites when package.json is missing', async () => {
    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-doctor-no-package-'))

    try {
      let result = runDoctorCommand([], tmpDir)

      assert.equal(result.status, 0, result.stderr)
      assert.match(result.stderr, /✗ environment/)
      assert.match(result.stderr, /• project \(skipped: Blocked by environment warnings\.\)/)
      assert.match(result.stderr, /• controllers \(skipped: Blocked by environment warnings\.\)/)
      assert.match(result.stdout, /environment:\n  • \[WARN\] Could not find package\.json\./)
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
      assert.match(result.stderr, /✗ environment/)
      assert.match(result.stderr, /• project \(skipped: Blocked by environment warnings\.\)/)
      assert.match(result.stderr, /• controllers \(skipped: Blocked by environment warnings\.\)/)
      assert.match(result.stdout, /environment:\n  • \[WARN\] package\.json is not valid JSON\./)
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
      assert.match(result.stderr, /✗ environment/)
      assert.match(
        result.stdout,
        /environment:\n  • \[WARN\] Project requires Node\.js >=99\.0\.0, but the current runtime is v\d+\.\d+\.\d+\./,
      )
      assert.match(result.stderr, /• project \(skipped: Blocked by environment warnings\.\)/)
      assert.match(result.stderr, /• controllers \(skipped: Blocked by environment warnings\.\)/)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('reports missing remix dependencies and skips later suites', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-env-missing-remix-dependency'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stderr, /✗ environment/)
    assert.match(result.stderr, /• project \(skipped: Blocked by environment warnings\.\)/)
    assert.match(result.stderr, /• controllers \(skipped: Blocked by environment warnings\.\)/)
    assert.match(
      result.stdout,
      /environment:\n  • \[WARN\] package\.json does not declare a remix dependency\./,
    )
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
      assert.match(fixResult.stderr, /✓ environment/)
      assert.match(fixResult.stdout, /environment:\n  Applied fixes:\n    • Updated package\.json/)

      let packageJson = JSON.parse(
        await fs.readFile(path.join(projectDir, 'package.json'), 'utf8'),
      ) as {
        dependencies: Record<string, string>
        engines: Record<string, string>
      }

      assert.equal(packageJson.dependencies.remix, 'latest')
      assert.equal(packageJson.engines.node, '>=24.3.0')

      let checkResult = runDoctorCommand([], projectDir)

      assert.equal(checkResult.status, 0, checkResult.stderr)
      assert.match(checkResult.stdout, /Doctor found no issues\./)
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
      assert.match(result.stderr, /✗ environment/)
      assert.match(result.stderr, /• project \(skipped: Blocked by environment warnings\.\)/)
      assert.match(result.stderr, /• controllers \(skipped: Blocked by environment warnings\.\)/)
      assert.match(
        result.stdout,
        /environment:\n  • \[WARN\] Could not resolve remix from this project\./,
      )
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
      assert.match(result.stderr, /✓ environment/)
      assert.match(result.stderr, /✗ project/)
      assert.match(result.stderr, /• controllers \(skipped: Blocked by project warnings\.\)/)
      assert.match(result.stdout, /project:\n  • \[WARN\] Project is missing app\/routes\.ts\./)
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

      let packageJson = JSON.parse(
        await fs.readFile(path.join(projectDir, 'package.json'), 'utf8'),
      ) as {
        engines: Record<string, string>
      }

      assert.equal(packageJson.engines.node, '>=24.3.0')

      let checkResult = runDoctorCommand([], projectDir)

      assert.equal(checkResult.status, 0, checkResult.stderr)
      assert.match(checkResult.stdout, /Doctor found no issues\./)
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('reports missing action and controller owners', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-missing'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stderr, /✗ controllers/)
    assert.match(
      result.stdout,
      /controllers:\n  • \[WARN\] Route "home" is missing action app\/controllers\/home\.tsx\./,
    )
    assert.match(
      result.stdout,
      /• \[WARN\] Route "contact" is missing controller app\/controllers\/contact\/controller\.tsx\./,
    )
    assert.match(result.stdout, /controller\.tsx\.\n\nSummary: 2 warnings, 0 advice\./)
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
      assert.match(fixResult.stderr, /✓ project/)
      assert.match(fixResult.stdout, /project:\n  Applied fixes:/)
      assert.match(fixResult.stdout, /Created app\/routes\.ts/)
      assert.match(fixResult.stdout, /Created app\/controllers\/home\.js/)

      let routesSource = await fs.readFile(path.join(projectDir, 'app', 'routes.ts'), 'utf8')
      let homeSource = await fs.readFile(
        path.join(projectDir, 'app', 'controllers', 'home.js'),
        'utf8',
      )

      assert.match(routesSource, /export const routes = route\(\{/)
      assert.match(routesSource, /home: '\//)
      assert.match(homeSource, /export const home = \{/)
      assert.match(homeSource, /content-type': 'text\/html; charset=utf-8'/)
      assert.match(homeSource, /<h1>Home<\/h1>/)

      let checkResult = runDoctorCommand([], projectDir)

      assert.equal(checkResult.status, 0, checkResult.stderr)
      assert.match(checkResult.stdout, /Doctor found no issues\./)
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('creates runnable placeholder owners for missing routes and leaves the project clean', async () => {
    let projectDir = await copyFixtureProject('doctor-missing')

    try {
      let fixResult = runDoctorCommand(['--fix'], projectDir)

      assert.equal(fixResult.status, 0, fixResult.stderr)
      assert.match(fixResult.stderr, /✓ controllers/)
      assert.match(fixResult.stdout, /Applied fixes:/)
      assert.match(fixResult.stdout, /Created app\/controllers\/home\.js/)
      assert.match(fixResult.stdout, /Created app\/controllers\/contact\/controller\.js/)
      assert.match(fixResult.stdout, /Applied 2 fixes\./)
      assert.match(fixResult.stdout, /Doctor found no issues\./)

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
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('accepts the global no-color flag', async () => {
    let result = runDoctorCommand(['--no-color'], getFixturePath('doctor-missing'))

    assert.equal(result.status, 0, result.stderr)
    assert.doesNotMatch(result.stdout, /\u001B\[/)
  })

  it('reports duplicate owner files for actions and controllers', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-duplicate-owner'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stderr, /✗ controllers/)
    assert.match(
      result.stdout,
      /• \[WARN\] Route "home" has multiple action files: app\/controllers\/home\.ts, app\/controllers\/home\.tsx\. Keep only one action owner file\./,
    )
    assert.match(
      result.stdout,
      /• \[WARN\] Route "contact" has multiple controller files: app\/controllers\/contact\/controller\.ts, app\/controllers\/contact\/controller\.jsx\. Keep only one controller owner file\./,
    )
  })

  it('reports incomplete controllers when a controller folder is missing its entry file', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-incomplete-controller'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stderr, /✗ controllers/)
    assert.match(
      result.stdout,
      /• \[WARN\] Route "contact" has files under app\/controllers\/contact, but is missing controller app\/controllers\/contact\/controller\.tsx\./,
    )
    assert.doesNotMatch(result.stdout, /Route "contact" is missing controller/)
  })

  it('creates a typed controller placeholder for incomplete controllers from local tsx evidence', async () => {
    let projectDir = await copyFixtureProject('doctor-incomplete-controller')

    try {
      let fixResult = runDoctorCommand(['--fix'], projectDir)

      assert.equal(fixResult.status, 0, fixResult.stderr)
      assert.match(fixResult.stderr, /✓ controllers/)
      assert.match(fixResult.stdout, /Created app\/controllers\/contact\/controller\.tsx/)

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
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('reports wrong owner kinds for actions and controller folders', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-wrong-kind'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stderr, /✗ controllers/)
    assert.match(
      result.stdout,
      /• \[WARN\] Route "home" expects action app\/controllers\/home\.tsx, but found controller app\/controllers\/home\/controller\.js\./,
    )
    assert.match(
      result.stdout,
      /• \[WARN\] Route "contact" expects controller app\/controllers\/contact\/controller\.tsx, but found standalone action app\/controllers\/contact\.ts\./,
    )
  })

  it('does not change non-fixable controller warnings', async () => {
    let projectDir = await copyFixtureProject('doctor-wrong-kind')

    try {
      let result = runDoctorCommand(['--fix'], projectDir)

      assert.equal(result.status, 1)
      assert.match(
        result.stdout,
        /Route "home" expects action app\/controllers\/home\.tsx, but found controller app\/controllers\/home\/controller\.js\./,
      )
      assert.match(
        result.stdout,
        /Route "contact" expects controller app\/controllers\/contact\/controller\.tsx, but found standalone action app\/controllers\/contact\.ts\./,
      )
      assert.doesNotMatch(result.stdout, /Applied fixes:/)
      await assertPathMissing(path.join(projectDir, 'app', 'controllers', 'home.tsx'))
      await assertPathMissing(
        path.join(projectDir, 'app', 'controllers', 'contact', 'controller.tsx'),
      )
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('reports promotion drift for standalone actions that also have route-local files', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-promotion-drift'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stderr, /✗ controllers/)
    assert.match(
      result.stdout,
      /• \[WARN\] Route "home" uses action app\/controllers\/home\.js, but also has files under app\/controllers\/home\. Promote it to controller app\/controllers\/home\/controller\.tsx or keep the route in app\/controllers\/home\.js\./,
    )
  })

  it('reports ambiguous owner mappings', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-ambiguous'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stderr, /✗ controllers/)
    assert.match(
      result.stdout,
      /• \[WARN\] Route "home" has both action app\/controllers\/home\.js and controller app\/controllers\/home\/controller\.ts\./,
    )
    assert.match(
      result.stdout,
      /• \[WARN\] Route "contact" has both controller app\/controllers\/contact\/controller\.jsx and standalone action app\/controllers\/contact\.ts\./,
    )
  })

  it('reports orphan actions and controller folders', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-orphans'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stderr, /✗ controllers/)
    assert.match(
      result.stdout,
      /• \[WARN\] Standalone action app\/controllers\/about\.jsx does not match any top-level route\./,
    )
    assert.match(
      result.stdout,
      /• \[WARN\] Controller app\/controllers\/unused\/controller\.js does not match any route group\./,
    )
  })

  it('reports extraneous route directories outside any controller route', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-orphan-route-local-file'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stderr, /✗ controllers/)
    assert.match(
      result.stdout,
      /• \[WARN\] Directory app\/controllers\/unused does not match any route subtree\./,
    )
  })

  it('reports extraneous route directories from the controller tree shape', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-generic-buckets'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stderr, /✗ controllers/)
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
  })

  it('allows route names like shared and common when the route map declares them', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-route-names'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stderr, /✓ controllers/)
    assert.doesNotMatch(result.stdout, /shared-bucket/)
  })

  it('uses kebab-case controller paths for camelCase route keys', async () => {
    let result = runDoctorCommand([], getFixturePath('doctor-camel-case-keys'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stderr, /✓ controllers/)
    assert.doesNotMatch(result.stdout, /forgotPassword/)
    assert.doesNotMatch(result.stdout, /resetPassword/)
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
      assert.match(fixResult.stderr, /✓ controllers/)
      assert.match(fixResult.stdout, /Created app\/controllers\/auth\/controller\.tsx/)
      assert.match(
        fixResult.stdout,
        /Created app\/controllers\/auth\/forgot-password\/controller\.tsx/,
      )
      assert.match(
        fixResult.stdout,
        /Created app\/controllers\/auth\/reset-password\/controller\.tsx/,
      )

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
      assert.match(result.stderr, /✓ controllers/)
      assert.match(result.stdout, /Created app\/controllers\/home\.ts/)
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
      assert.match(result.stderr, /✓ controllers/)
      assert.match(result.stdout, /Created app\/controllers\/home\.jsx/)
      await assertPathExists(path.join(projectDir, 'app', 'controllers', 'home.jsx'))
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('reports project warnings when routes is not exported', async () => {
    let result = runDoctorCommand([], getFixturePath('routes-no-export'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stderr, /✗ project/)
    assert.match(result.stderr, /• controllers \(skipped: Blocked by project warnings\.\)/)
    assert.match(
      result.stdout,
      /project:\n  • \[WARN\] app\/routes\.ts must export a named "routes" value\./,
    )
  })

  it('reports project warnings when the route map is invalid', async () => {
    let result = runDoctorCommand([], getFixturePath('routes-invalid-value'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stderr, /✗ project/)
    assert.match(result.stderr, /• controllers \(skipped: Blocked by project warnings\.\)/)
    assert.match(result.stdout, /project:\n  • \[WARN\] Invalid route map value at "broken"/)
  })

  it('reports project warnings when importing routes throws', async () => {
    let result = runDoctorCommand([], getFixturePath('routes-import-error'))

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stderr, /✗ project/)
    assert.match(result.stderr, /• controllers \(skipped: Blocked by project warnings\.\)/)
    assert.match(
      result.stdout,
      /project:\n  • \[WARN\] Failed to load app\/routes\.ts: boom from routes fixture/,
    )
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
    assert.match(result.stderr, /✗ controllers/)
  })

  it('fails strict mode when project warnings are present', async () => {
    let result = runDoctorCommand(['--strict'], getFixturePath('routes-no-export'))

    assert.equal(result.status, 1)
    assert.match(result.stdout, /must export a named "routes" value/)
    assert.match(result.stderr, /✗ project/)
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
