import { spawn } from 'node:child_process'
import * as assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as process from 'node:process'
import { describe, it } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const REMIX_PACKAGE_PATH = path.join(ROOT_DIR, 'packages', 'remix')
const NODE_TSX_PACKAGE_PATH = path.join(ROOT_DIR, 'packages', 'node-tsx')
let builtNodeTsxPackage = false

describe('node-tsx', () => {
  it('runs ts entrypoints that import tsx modules through remix/node-tsx', async () => {
    await withProject(async (projectPath) => {
      await linkRemixPackage(projectPath)
      await writeJsxRuntime(projectPath)
      await writeProjectFile(
        projectPath,
        'server.ts',
        ["import { render } from './view.tsx'", 'console.log(JSON.stringify(render()))', ''].join(
          '\n',
        ),
      )
      await writeProjectFile(
        projectPath,
        'view.tsx',
        ['export function render() {', '  return <div>Hello</div>', '}', ''].join('\n'),
      )

      let result = await runNode(['--import', 'remix/node-tsx', './server.ts'], projectPath)

      assert.equal(result.exitCode, 0, result.stderr)
      assert.equal(result.stderr, '')
      assert.deepEqual(JSON.parse(result.stdout.trim()), {
        props: { children: 'Hello' },
        type: 'div',
      })
    })
  })

  it('runs tsx entrypoints through remix/node-tsx', async () => {
    await withProject(async (projectPath) => {
      await linkRemixPackage(projectPath)
      await writeJsxRuntime(projectPath)
      await writeProjectFile(
        projectPath,
        'server.tsx',
        ['let element = <div>Hello</div>', 'console.log(JSON.stringify(element))', ''].join('\n'),
      )

      let result = await runNode(['--import', 'remix/node-tsx', './server.tsx'], projectPath)

      assert.equal(result.exitCode, 0, result.stderr)
      assert.equal(result.stderr, '')
      assert.deepEqual(JSON.parse(result.stdout.trim()), {
        props: { children: 'Hello' },
        type: 'div',
      })
    })
  })

  it('runs jsx entrypoints through remix/node-tsx', async () => {
    await withProject(async (projectPath) => {
      await linkRemixPackage(projectPath)
      await writeJsxRuntime(projectPath)
      await writeProjectFile(
        projectPath,
        'server.jsx',
        ['let element = <div>Hello</div>', 'console.log(JSON.stringify(element))', ''].join('\n'),
      )

      let result = await runNode(['--import', 'remix/node-tsx', './server.jsx'], projectPath)

      assert.equal(result.exitCode, 0, result.stderr)
      assert.equal(result.stderr, '')
      assert.deepEqual(JSON.parse(result.stdout.trim()), {
        props: { children: 'Hello' },
        type: 'div',
      })
    })
  })

  it('reports syntax errors in tsx files', async () => {
    await withProject(async (projectPath) => {
      await linkRemixPackage(projectPath)
      await writeJsxRuntime(projectPath)
      await writeProjectFile(
        projectPath,
        'server.tsx',
        ['let element = <div>Hello</span>', 'console.log(JSON.stringify(element))', ''].join('\n'),
      )

      let result = await runNode(['--import', 'remix/node-tsx', './server.tsx'], projectPath)

      assert.notEqual(result.exitCode, 0)
      assert.equal(
        normalizeNodeError(result.stderr, projectPath),
        [
          'node:internal/modules/run_main:<line>',
          '    triggerUncaughtException(',
          '    ^',
          '',
          '[',
          "  x Expected corresponding JSX closing tag for 'div'.",
          '   ,-[<project>/server.tsx:1:27]',
          ' 1 | let element = <div>Hello</span>',
          '   :                ^|^        ^^|^',
          '   :                 |           `-- Expected `</div>`',
          '   :                 `-- Opened here',
          ' 2 | console.log(JSON.stringify(element))',
          '   `----',
          '',
          "SyntaxError: Expected corresponding JSX closing tag for 'div'.]",
          '',
          'Node.js <version>',
          '',
        ].join('\n'),
      )
    })
  })

  it('reports syntax errors in jsx files', async () => {
    await withProject(async (projectPath) => {
      await linkRemixPackage(projectPath)
      await writeJsxRuntime(projectPath)
      await writeProjectFile(
        projectPath,
        'server.jsx',
        ['let element = <main>Hello</section>', 'console.log(JSON.stringify(element))', ''].join(
          '\n',
        ),
      )

      let result = await runNode(['--import', 'remix/node-tsx', './server.jsx'], projectPath)

      assert.notEqual(result.exitCode, 0)
      assert.equal(
        normalizeNodeError(result.stderr, projectPath),
        [
          'node:internal/modules/run_main:<line>',
          '    triggerUncaughtException(',
          '    ^',
          '',
          '[',
          "  x Expected corresponding JSX closing tag for 'main'.",
          '   ,-[<project>/server.jsx:1:28]',
          ' 1 | let element = <main>Hello</section>',
          '   :                ^^|^        ^^^|^^^',
          '   :                  |            `-- Expected `</main>`',
          '   :                  `-- Opened here',
          ' 2 | console.log(JSON.stringify(element))',
          '   `----',
          '',
          "SyntaxError: Expected corresponding JSX closing tag for 'main'.]",
          '',
          'Node.js <version>',
          '',
        ].join('\n'),
      )
    })
  })

  it('maps errors in transformed modules back to the original source', async () => {
    await withProject(async (projectPath) => {
      await linkRemixPackage(projectPath)
      await writeJsxRuntime(projectPath)
      await writeProjectFile(
        projectPath,
        'server.ts',
        ["import { render } from './view.tsx'", 'render()', ''].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'view.tsx',
        [
          'export function render() {',
          '  let element = <div>Hello</div>',
          '  throw new Error(`render failed for ${element.type}`)',
          '}',
          '',
        ].join('\n'),
      )

      let result = await runNode(['--import', 'remix/node-tsx', './server.ts'], projectPath)

      assert.notEqual(result.exitCode, 0)
      assert.match(result.stderr, /render failed for div/)
      assert.match(result.stderr, /view\.tsx:3:\d+/)
    })
  })

  it('runs TypeScript files with transform-only syntax through remix/node-tsx', async () => {
    await withProject(async (projectPath) => {
      await linkRemixPackage(projectPath)
      await writeProjectFile(
        projectPath,
        'server.ts',
        [
          'enum Status {',
          '  Ready = "ready",',
          '}',
          '',
          'namespace Labels {',
          '  export const status = "status"',
          '}',
          '',
          'class Message {',
          '  constructor(public text: string) {}',
          '}',
          '',
          'let message = new Message(Status.Ready)',
          'console.log(JSON.stringify({ [Labels.status]: message.text }))',
          '',
        ].join('\n'),
      )

      let result = await runNode(['--import', 'remix/node-tsx', './server.ts'], projectPath)

      assert.equal(result.exitCode, 0, result.stderr)
      assert.equal(result.stderr, '')
      assert.deepEqual(JSON.parse(result.stdout.trim()), { status: 'ready' })
    })
  })

  it('detects module syntax in TypeScript files outside packages', async () => {
    await withPackageLessProject(async (projectPath) => {
      await linkRemixPackage(projectPath)
      await writeProjectFile(
        projectPath,
        'server.ts',
        [
          'enum Status {',
          '  Ready = "ready",',
          '}',
          '',
          'export const status = Status.Ready',
          'console.log(status)',
          '',
        ].join('\n'),
      )

      let result = await runNode(['--import', 'remix/node-tsx', './server.ts'], projectPath)

      assert.equal(result.exitCode, 0, result.stderr)
      assert.equal(result.stderr, '')
      assert.equal(result.stdout.trim(), 'ready')
    })
  })

  it('defaults TypeScript files outside packages without module syntax to CommonJS', async () => {
    await withPackageLessProject(async (projectPath) => {
      await linkRemixPackage(projectPath)
      await writeProjectFile(
        projectPath,
        'server.ts',
        [
          'namespace Labels {',
          '  export const status = "ready"',
          '}',
          '',
          'module.exports = { status: Labels.status }',
          'console.log(module.exports.status)',
          '',
        ].join('\n'),
      )

      let result = await runNode(['--import', 'remix/node-tsx', './server.ts'], projectPath)

      assert.equal(result.exitCode, 0, result.stderr)
      assert.equal(result.stderr, '')
      assert.equal(result.stdout.trim(), 'ready')
    })
  })

  it('rejects JSX syntax in ts files', async () => {
    await withProject(async (projectPath) => {
      await linkRemixPackage(projectPath)
      await writeProjectFile(
        projectPath,
        'server.ts',
        ['let element = <div>Hello</div>', 'console.log(element)', ''].join('\n'),
      )

      let result = await runNode(['--import', 'remix/node-tsx', './server.ts'], projectPath)

      assert.notEqual(result.exitCode, 0)
      assert.match(result.stderr, /server\.ts/)
      assert.match(result.stderr, /SyntaxError|ERR_INVALID_TYPESCRIPT_SYNTAX/)
    })
  })

  it('runs tsx modules from symlinked workspace packages', async () => {
    await withProject(async (projectPath) => {
      await linkRemixPackage(projectPath)
      await writeJsxRuntime(projectPath)
      await writeProjectFile(
        projectPath,
        'workspace-package/package.json',
        [
          '{',
          '  "name": "workspace-package",',
          '  "type": "module",',
          '  "exports": {',
          '    "./view": "./view.tsx"',
          '  }',
          '}',
          '',
        ].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'workspace-package/tsconfig.json',
        [
          '{',
          '  "compilerOptions": {',
          '    "jsx": "react-jsx",',
          '    "jsxImportSource": "jsx-package"',
          '  }',
          '}',
          '',
        ].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'workspace-package/view.tsx',
        ['export function render() {', '  return <main>Workspace</main>', '}', ''].join('\n'),
      )
      await fs.symlink(
        path.join(projectPath, 'workspace-package'),
        path.join(projectPath, 'node_modules', 'workspace-package'),
      )
      await writeProjectFile(
        projectPath,
        'server.ts',
        [
          "import { render } from 'workspace-package/view'",
          'console.log(JSON.stringify(render()))',
          '',
        ].join('\n'),
      )

      let result = await runNode(['--import', 'remix/node-tsx', './server.ts'], projectPath)

      assert.equal(result.exitCode, 0, result.stderr)
      assert.equal(result.stderr, '')
      assert.deepEqual(JSON.parse(result.stdout.trim()), {
        props: { children: 'Workspace' },
        type: 'main',
      })
    })
  })

  it('only uses jsx tsconfig options from real node_modules paths', async () => {
    await withProject(async (projectPath) => {
      await linkRemixPackage(projectPath)
      await writeJsxRuntime(projectPath)
      await writeProjectFile(
        projectPath,
        'node_modules/raw-tsx/package.json',
        [
          '{',
          '  "name": "raw-tsx",',
          '  "type": "module",',
          '  "exports": {',
          '    "./view": "./view.tsx"',
          '  }',
          '}',
          '',
        ].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'node_modules/raw-tsx/tsconfig.json',
        [
          '{',
          '  "compilerOptions": {',
          '    "jsx": "react-jsx",',
          '    "jsxImportSource": "jsx-package",',
          '    "module": "CommonJS",',
          '    "paths": {',
          '      "jsx-package/jsx-runtime": ["./missing-jsx-runtime.js"]',
          '    }',
          '  }',
          '}',
          '',
        ].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'node_modules/raw-tsx/view.tsx',
        ['export function render() {', '  return <main>Dependency</main>', '}', ''].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'server.ts',
        ["import { render } from 'raw-tsx/view'", 'console.log(JSON.stringify(render()))', ''].join(
          '\n',
        ),
      )

      let result = await runNode(['--import', 'remix/node-tsx', './server.ts'], projectPath)

      assert.equal(result.exitCode, 0, result.stderr)
      assert.equal(result.stderr, '')
      assert.deepEqual(JSON.parse(result.stdout.trim()), {
        props: { children: 'Dependency' },
        type: 'main',
      })
    })
  })

  it('supports jsxImportSource pragmas in transformed modules', async () => {
    await withProject(async (projectPath) => {
      await linkRemixPackage(projectPath)
      await writeJsxRuntime(projectPath)
      await writeProjectFile(
        projectPath,
        'node_modules/jsx-pragma-package/package.json',
        [
          '{',
          '  "name": "jsx-pragma-package",',
          '  "type": "module",',
          '  "exports": {',
          '    "./jsx-runtime": "./jsx-runtime.js"',
          '  }',
          '}',
          '',
        ].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'node_modules/jsx-pragma-package/jsx-runtime.js',
        [
          'export const Fragment = "Fragment"',
          '',
          'export function jsx(type, props) {',
          '  return { source: "pragma", type, props: props ?? null }',
          '}',
          '',
          'export { jsx as jsxs }',
          '',
        ].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'server.tsx',
        [
          '/** @jsxImportSource jsx-pragma-package */',
          'let element = <div>Hello</div>',
          'console.log(JSON.stringify(element))',
          '',
        ].join('\n'),
      )

      let result = await runNode(['--import', 'remix/node-tsx', './server.tsx'], projectPath)

      assert.equal(result.exitCode, 0, result.stderr)
      assert.equal(result.stderr, '')
      assert.deepEqual(JSON.parse(result.stdout.trim()), {
        props: { children: 'Hello' },
        source: 'pragma',
        type: 'div',
      })
    })
  })

  it('supports classic jsx factory pragmas in transformed modules', async () => {
    await withProject(async (projectPath) => {
      await linkRemixPackage(projectPath)
      await writeProjectFile(
        projectPath,
        'tsconfig.json',
        [
          '{',
          '  "compilerOptions": {',
          '    "jsx": "react",',
          '    "jsxFactory": "jsxRuntime.createElement",',
          '    "jsxFragmentFactory": "jsxRuntime.Fragment"',
          '  }',
          '}',
          '',
        ].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'server.tsx',
        [
          '/** @jsx h */',
          '/** @jsxFrag Fragment */',
          'const Fragment = "Fragment"',
          '',
          'function h(type, props, ...children) {',
          '  return {',
          '    source: "pragma",',
          '    type,',
          '    props: {',
          '      ...(props ?? {}),',
          '      children: children.length <= 1 ? children[0] : children,',
          '    },',
          '  }',
          '}',
          '',
          'let element = <>',
          '  <div>Hello</div>',
          '</>',
          'console.log(JSON.stringify(element))',
          '',
        ].join('\n'),
      )

      let result = await runNode(['--import', 'remix/node-tsx', './server.tsx'], projectPath)

      assert.equal(result.exitCode, 0, result.stderr)
      assert.equal(result.stderr, '')
      assert.deepEqual(JSON.parse(result.stdout.trim()), {
        props: {
          children: {
            props: { children: 'Hello' },
            source: 'pragma',
            type: 'div',
          },
        },
        source: 'pragma',
        type: 'Fragment',
      })
    })
  })

  it('uses the automatic jsx runtime when no jsx tsconfig option is configured', async () => {
    await withProject(async (projectPath) => {
      await linkRemixPackage(projectPath)
      await writeProjectFile(
        projectPath,
        'tsconfig.json',
        [
          '{',
          '  "compilerOptions": {',
          '    "jsxImportSource": "jsx-package"',
          '  }',
          '}',
          '',
        ].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'node_modules/jsx-package/package.json',
        [
          '{',
          '  "name": "jsx-package",',
          '  "type": "module",',
          '  "exports": {',
          '    "./jsx-runtime": "./jsx-runtime.js"',
          '  }',
          '}',
          '',
        ].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'node_modules/jsx-package/jsx-runtime.js',
        [
          'export const Fragment = "Fragment"',
          '',
          'export function jsx(type, props) {',
          '  return { source: "jsx-package", type, props: props ?? null }',
          '}',
          '',
          'export { jsx as jsxs }',
          '',
        ].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'server.tsx',
        ['let element = <div>Hello</div>', 'console.log(JSON.stringify(element))', ''].join('\n'),
      )

      let result = await runNode(['--import', 'remix/node-tsx', './server.tsx'], projectPath)

      assert.equal(result.exitCode, 0, result.stderr)
      assert.equal(result.stderr, '')
      assert.deepEqual(JSON.parse(result.stdout.trim()), {
        props: { children: 'Hello' },
        source: 'jsx-package',
        type: 'div',
      })
    })
  })

  it('uses the development automatic jsx runtime for jsxdev mode', async () => {
    await withProject(async (projectPath) => {
      await linkRemixPackage(projectPath)
      await writeProjectFile(
        projectPath,
        'tsconfig.json',
        [
          '{',
          '  "compilerOptions": {',
          '    "jsx": "react-jsxdev",',
          '    "jsxImportSource": "jsx-package"',
          '  }',
          '}',
          '',
        ].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'node_modules/jsx-package/package.json',
        [
          '{',
          '  "name": "jsx-package",',
          '  "type": "module",',
          '  "exports": {',
          '    "./jsx-dev-runtime": "./jsx-dev-runtime.js"',
          '  }',
          '}',
          '',
        ].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'node_modules/jsx-package/jsx-dev-runtime.js',
        [
          'export const Fragment = "Fragment"',
          '',
          'export function jsxDEV(type, props) {',
          '  return { development: true, type, props: props ?? null }',
          '}',
          '',
        ].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'server.tsx',
        ['let element = <div>Hello</div>', 'console.log(JSON.stringify(element))', ''].join('\n'),
      )

      let result = await runNode(['--import', 'remix/node-tsx', './server.tsx'], projectPath)

      assert.equal(result.exitCode, 0, result.stderr)
      assert.equal(result.stderr, '')
      assert.deepEqual(JSON.parse(result.stdout.trim()), {
        development: true,
        props: { children: 'Hello' },
        type: 'div',
      })
    })
  })

  it('rejects invalid jsx tsconfig option values', async () => {
    await withProject(async (projectPath) => {
      await linkRemixPackage(projectPath)
      await writeProjectFile(
        projectPath,
        'tsconfig.json',
        [
          '{',
          '  "compilerOptions": {',
          '    "jsx": "react-jsx",',
          '    "jsxImportSource": ["jsx-package"]',
          '  }',
          '}',
          '',
        ].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'server.tsx',
        ['let element = <div>Hello</div>', 'console.log(JSON.stringify(element))', ''].join('\n'),
      )

      let result = await runNode(['--import', 'remix/node-tsx', './server.tsx'], projectPath)

      assert.notEqual(result.exitCode, 0)
      assert.match(result.stderr, /Invalid tsconfig compilerOptions/)
      assert.match(result.stderr, /compilerOptions\.jsxImportSource: Expected string/)
    })
  })

  it('rejects preserve jsx mode because it leaves jsx syntax behind', async () => {
    await withProject(async (projectPath) => {
      await linkRemixPackage(projectPath)
      await writeProjectFile(
        projectPath,
        'tsconfig.json',
        ['{', '  "compilerOptions": {', '    "jsx": "preserve"', '  }', '}', ''].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'server.tsx',
        ['let element = <div>Hello</div>', 'console.log(JSON.stringify(element))', ''].join('\n'),
      )

      let result = await runNode(['--import', 'remix/node-tsx', './server.tsx'], projectPath)

      assert.notEqual(result.exitCode, 0)
      assert.match(result.stderr, /Unsupported tsconfig compilerOptions\.jsx = "preserve"/)
    })
  })

  it('rejects native jsx mode because it leaves jsx syntax behind', async () => {
    await withProject(async (projectPath) => {
      await linkRemixPackage(projectPath)
      await writeProjectFile(
        projectPath,
        'tsconfig.json',
        ['{', '  "compilerOptions": {', '    "jsx": "react-native"', '  }', '}', ''].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'server.tsx',
        ['let element = <div>Hello</div>', 'console.log(JSON.stringify(element))', ''].join('\n'),
      )

      let result = await runNode(['--import', 'remix/node-tsx', './server.tsx'], projectPath)

      assert.notEqual(result.exitCode, 0)
      assert.match(result.stderr, /Unsupported tsconfig compilerOptions\.jsx = "react-native"/)
    })
  })

  it('loads ts entrypoints with tsx imports through remix/node-tsx/load-module', async () => {
    await withProject(async (projectPath) => {
      await linkRemixPackage(projectPath)
      await writeJsxRuntime(projectPath)
      await writeProjectFile(
        projectPath,
        'start.mjs',
        [
          "import { loadModule } from 'remix/node-tsx/load-module'",
          '',
          "let { render } = await loadModule('./server.ts', import.meta.url)",
          'console.log(JSON.stringify(render()))',
          '',
        ].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'server.ts',
        ["import { render } from './view.tsx'", '', 'export { render }', ''].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'view.tsx',
        ['export function render() {', '  return <div>Hello</div>', '}', ''].join('\n'),
      )

      let result = await runNode(['./start.mjs'], projectPath)

      assert.equal(result.exitCode, 0, result.stderr)
      assert.equal(result.stderr, '')
      assert.deepEqual(JSON.parse(result.stdout.trim()), {
        props: { children: 'Hello' },
        type: 'div',
      })
    })
  })

  it('loads ts entrypoints through the built load-module file', async () => {
    await ensureBuiltNodeTsxPackage()

    await withProject(async (projectPath) => {
      await writeJsxRuntime(projectPath)
      let loadModuleURL = pathToFileURL(path.join(NODE_TSX_PACKAGE_PATH, 'dist', 'load-module.js'))
      await writeProjectFile(
        projectPath,
        'start.mjs',
        [
          `import { loadModule } from ${JSON.stringify(loadModuleURL.href)}`,
          '',
          "let { render } = await loadModule('./server.ts', import.meta.url)",
          'console.log(JSON.stringify(render()))',
          '',
        ].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'server.ts',
        ["import { render } from './view.tsx'", '', 'export { render }', ''].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'view.tsx',
        ['export function render() {', '  return <div>Built</div>', '}', ''].join('\n'),
      )

      let result = await runNode(['./start.mjs'], projectPath)

      assert.equal(result.exitCode, 0, result.stderr)
      assert.equal(result.stderr, '')
      assert.deepEqual(JSON.parse(result.stdout.trim()), {
        props: { children: 'Built' },
        type: 'div',
      })
    })
  })

  it('loads TypeScript modules with transform-only syntax through remix/node-tsx/load-module', async () => {
    await withProject(async (projectPath) => {
      await linkRemixPackage(projectPath)
      await writeProjectFile(
        projectPath,
        'start.mjs',
        [
          "import { loadModule } from 'remix/node-tsx/load-module'",
          '',
          "let { render } = await loadModule('./server.ts', import.meta.url)",
          'console.log(JSON.stringify(render()))',
          '',
        ].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'server.ts',
        [
          'enum ElementType {',
          '  Main = "main",',
          '}',
          '',
          'class ElementDescriptor {',
          '  constructor(public type: ElementType) {}',
          '}',
          '',
          'export function render() {',
          '  let element = new ElementDescriptor(ElementType.Main)',
          '  return { type: element.type }',
          '}',
          '',
        ].join('\n'),
      )

      let result = await runNode(['./start.mjs'], projectPath)

      assert.equal(result.exitCode, 0, result.stderr)
      assert.equal(result.stderr, '')
      assert.deepEqual(JSON.parse(result.stdout.trim()), { type: 'main' })
    })
  })

  it('loads package export graphs through remix/node-tsx/load-module', async () => {
    await withProject(async (projectPath) => {
      await linkRemixPackage(projectPath)
      await writeJsxRuntime(projectPath)
      await writeProjectFile(
        projectPath,
        'node_modules/scoped-package/package.json',
        [
          '{',
          '  "name": "scoped-package",',
          '  "type": "module",',
          '  "exports": {',
          '    "./view": "./view.tsx"',
          '  }',
          '}',
          '',
        ].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'node_modules/scoped-package/view.tsx',
        [
          "import { createChild } from './child.tsx'",
          '',
          'export function render() {',
          '  return createChild()',
          '}',
          '',
        ].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'node_modules/scoped-package/child.tsx',
        ['export function createChild() {', '  return <main>Scoped package</main>', '}', ''].join(
          '\n',
        ),
      )
      await writeProjectFile(
        projectPath,
        'start.mjs',
        [
          "import { loadModule } from 'remix/node-tsx/load-module'",
          '',
          "let { render } = await loadModule('scoped-package/view', import.meta.url)",
          'console.log(JSON.stringify(render()))',
          '',
        ].join('\n'),
      )

      let result = await runNode(['./start.mjs'], projectPath)

      assert.equal(result.exitCode, 0, result.stderr)
      assert.equal(result.stderr, '')
      assert.deepEqual(JSON.parse(result.stdout.trim()), {
        props: { children: 'Scoped package' },
        type: 'main',
      })
    })
  })

  it('scopes loadModule to the requested import graph', async () => {
    await withProject(async (projectPath) => {
      await linkRemixPackage(projectPath)
      await writeJsxRuntime(projectPath)
      await writeProjectFile(
        projectPath,
        'start.mjs',
        [
          "import { loadModule } from 'remix/node-tsx/load-module'",
          '',
          "let { render } = await loadModule('./view.tsx', import.meta.url)",
          'console.log(JSON.stringify(render()))',
          '',
          "await import('./view.tsx').then(",
          "  () => console.log('unexpected success'),",
          "  () => console.log('scoped import only')",
          ')',
          '',
        ].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'view.tsx',
        ['export function render() {', '  return <div>Hello</div>', '}', ''].join('\n'),
      )

      let result = await runNode(['./start.mjs'], projectPath)

      assert.equal(result.exitCode, 0, result.stderr)
      assert.equal(result.stderr, '')
      let [rendered, scopeMessage] = result.stdout.trim().split('\n')
      assert.deepEqual(JSON.parse(rendered), {
        props: { children: 'Hello' },
        type: 'div',
      })
      assert.equal(scopeMessage, 'scoped import only')
    })
  })

  it('keeps separate loadModule registrations isolated from each other', async () => {
    await withProject(async (projectPath) => {
      await linkRemixPackage(projectPath)
      await writeProjectFile(
        projectPath,
        'app-a/tsconfig.json',
        [
          '{',
          '  "compilerOptions": {',
          '    "jsx": "react-jsx",',
          '    "jsxImportSource": "jsx-a"',
          '  }',
          '}',
          '',
        ].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'app-b/tsconfig.json',
        [
          '{',
          '  "compilerOptions": {',
          '    "jsx": "react-jsx",',
          '    "jsxImportSource": "jsx-b"',
          '  }',
          '}',
          '',
        ].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'node_modules/jsx-a/package.json',
        [
          '{',
          '  "name": "jsx-a",',
          '  "type": "module",',
          '  "exports": {',
          '    "./jsx-runtime": "./jsx-runtime.js"',
          '  }',
          '}',
          '',
        ].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'node_modules/jsx-a/jsx-runtime.js',
        [
          'export const Fragment = "Fragment"',
          '',
          'export function jsx(type, props) {',
          '  return { source: "a", type, props: props ?? null }',
          '}',
          '',
          'export { jsx as jsxs }',
          '',
        ].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'node_modules/jsx-b/package.json',
        [
          '{',
          '  "name": "jsx-b",',
          '  "type": "module",',
          '  "exports": {',
          '    "./jsx-runtime": "./jsx-runtime.js"',
          '  }',
          '}',
          '',
        ].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'node_modules/jsx-b/jsx-runtime.js',
        [
          'export const Fragment = "Fragment"',
          '',
          'export function jsx(type, props) {',
          '  return { source: "b", type, props: props ?? null }',
          '}',
          '',
          'export { jsx as jsxs }',
          '',
        ].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'app-a/view.tsx',
        ['export function render() {', '  return <section>A</section>', '}', ''].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'app-b/view.tsx',
        ['export function render() {', '  return <article>B</article>', '}', ''].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'start.mjs',
        [
          "import { loadModule } from 'remix/node-tsx/load-module'",
          '',
          "let first = await loadModule('./app-a/view.tsx', import.meta.url)",
          "let second = await loadModule('./app-b/view.tsx', import.meta.url)",
          'console.log(JSON.stringify([first.render(), second.render()]))',
          '',
        ].join('\n'),
      )

      let result = await runNode(['./start.mjs'], projectPath)

      assert.equal(result.exitCode, 0, result.stderr)
      assert.equal(result.stderr, '')
      assert.deepEqual(JSON.parse(result.stdout.trim()), [
        {
          props: { children: 'A' },
          source: 'a',
          type: 'section',
        },
        {
          props: { children: 'B' },
          source: 'b',
          type: 'article',
        },
      ])
    })
  })

  it('resolves loadModule requests from URL parents and absolute paths', async () => {
    await withProject(async (projectPath) => {
      await linkRemixPackage(projectPath)
      await writeJsxRuntime(projectPath)
      await writeProjectFile(
        projectPath,
        'relative.tsx',
        ['export function render() {', '  return <span>Relative</span>', '}', ''].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'absolute.tsx',
        ['export function render() {', '  return <strong>Absolute</strong>', '}', ''].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'start.mjs',
        [
          "import * as path from 'node:path'",
          "import { fileURLToPath } from 'node:url'",
          "import { loadModule } from 'remix/node-tsx/load-module'",
          '',
          'let projectDir = path.dirname(fileURLToPath(import.meta.url))',
          "let relative = await loadModule('./relative.tsx', new URL('./start.mjs', import.meta.url))",
          "let absolute = await loadModule(path.join(projectDir, 'absolute.tsx'), import.meta.url)",
          'console.log(JSON.stringify([relative.render(), absolute.render()]))',
          '',
        ].join('\n'),
      )

      let result = await runNode(['./start.mjs'], projectPath)

      assert.equal(result.exitCode, 0, result.stderr)
      assert.equal(result.stderr, '')
      assert.deepEqual(JSON.parse(result.stdout.trim()), [
        {
          props: { children: 'Relative' },
          type: 'span',
        },
        {
          props: { children: 'Absolute' },
          type: 'strong',
        },
      ])
    })
  })

  it('uses the nearest package type for nested tsx modules', async () => {
    await withProject(async (projectPath) => {
      await linkRemixPackage(projectPath)
      await writeProjectFile(
        projectPath,
        'tsconfig.json',
        [
          '{',
          '  "compilerOptions": {',
          '    "jsx": "react",',
          '    "jsxFactory": "jsxRuntime.createElement"',
          '  }',
          '}',
          '',
        ].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'nested/package.json',
        ['{', '  "type": "commonjs"', '}', ''].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'nested/view.tsx',
        [
          'module.exports.render = function render() {',
          '  return <div>Nested CommonJS</div>',
          '}',
          '',
        ].join('\n'),
      )
      await writeProjectFile(
        projectPath,
        'server.ts',
        [
          'globalThis.jsxRuntime = {',
          '  createElement(type, props, ...children) {',
          '    return {',
          '      type,',
          '      props: {',
          '        ...(props ?? {}),',
          '        children: children.length <= 1 ? children[0] : children,',
          '      },',
          '    }',
          '  },',
          '}',
          '',
          "let view = await import('./nested/view.tsx')",
          'console.log(JSON.stringify(view.default.render()))',
          '',
        ].join('\n'),
      )

      let result = await runNode(['--import', 'remix/node-tsx', './server.ts'], projectPath)

      assert.equal(result.exitCode, 0, result.stderr)
      assert.equal(result.stderr, '')
      assert.deepEqual(JSON.parse(result.stdout.trim()), {
        props: { children: 'Nested CommonJS' },
        type: 'div',
      })
    })
  })

  it('preserves CommonJS format for tsx modules in CommonJS packages', async () => {
    await withProject(
      async (projectPath) => {
        await linkRemixPackage(projectPath)
        await writeProjectFile(
          projectPath,
          'tsconfig.json',
          [
            '{',
            '  "compilerOptions": {',
            '    "jsx": "react",',
            '    "jsxFactory": "jsxRuntime.createElement"',
            '  }',
            '}',
            '',
          ].join('\n'),
        )
        await writeProjectFile(
          projectPath,
          'server.tsx',
          [
            'globalThis.jsxRuntime = {',
            '  createElement(type, props, ...children) {',
            '    return {',
            '      type,',
            '      props: {',
            '        ...(props ?? {}),',
            '        children: children.length <= 1 ? children[0] : children,',
            '      },',
            '    }',
            '  },',
            '}',
            '',
            "let { render } = require('./view.tsx')",
            'console.log(JSON.stringify(render()))',
            '',
          ].join('\n'),
        )
        await writeProjectFile(
          projectPath,
          'view.tsx',
          [
            'module.exports.render = function render() {',
            '  return <div>Hello</div>',
            '}',
            '',
          ].join('\n'),
        )

        let result = await runNode(['--import', 'remix/node-tsx', './server.tsx'], projectPath)

        assert.equal(result.exitCode, 0, result.stderr)
        assert.equal(result.stderr, '')
        assert.deepEqual(JSON.parse(result.stdout.trim()), {
          props: { children: 'Hello' },
          type: 'div',
        })
      },
      { packageType: 'commonjs' },
    )
  })

  it('preserves CommonJS format for jsx modules in CommonJS packages', async () => {
    await withProject(
      async (projectPath) => {
        await linkRemixPackage(projectPath)
        await writeProjectFile(
          projectPath,
          'tsconfig.json',
          [
            '{',
            '  "compilerOptions": {',
            '    "jsx": "react",',
            '    "jsxFactory": "jsxRuntime.createElement"',
            '  }',
            '}',
            '',
          ].join('\n'),
        )
        await writeProjectFile(
          projectPath,
          'server.jsx',
          [
            'globalThis.jsxRuntime = {',
            '  createElement(type, props, ...children) {',
            '    return {',
            '      type,',
            '      props: {',
            '        ...(props ?? {}),',
            '        children: children.length <= 1 ? children[0] : children,',
            '      },',
            '    }',
            '  },',
            '}',
            '',
            "let { render } = require('./view.jsx')",
            'console.log(JSON.stringify(render()))',
            '',
          ].join('\n'),
        )
        await writeProjectFile(
          projectPath,
          'view.jsx',
          [
            'module.exports.render = function render() {',
            '  return <div>Hello</div>',
            '}',
            '',
          ].join('\n'),
        )

        let result = await runNode(['--import', 'remix/node-tsx', './server.jsx'], projectPath)

        assert.equal(result.exitCode, 0, result.stderr)
        assert.equal(result.stderr, '')
        assert.deepEqual(JSON.parse(result.stdout.trim()), {
          props: { children: 'Hello' },
          type: 'div',
        })
      },
      { packageType: 'commonjs' },
    )
  })
})

async function runNode(
  argv: string[],
  cwd: string,
): Promise<{ exitCode: number; stderr: string; stdout: string }> {
  return await runProcess(process.execPath, argv, cwd)
}

async function runProcess(
  command: string,
  argv: string[],
  cwd: string,
): Promise<{ exitCode: number; stderr: string; stdout: string }> {
  let child = spawn(command, argv, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  let childStdout = child.stdout
  let childStderr = child.stderr

  if (childStdout == null || childStderr == null) {
    throw new Error('Node process did not expose stdout/stderr pipes')
  }

  childStdout.setEncoding('utf8')
  childStderr.setEncoding('utf8')
  childStdout.on('data', (chunk: string) => {
    stdout += chunk
  })
  childStderr.on('data', (chunk: string) => {
    stderr += chunk
  })

  let result = await waitForClose(child)
  if (result.signal != null) {
    throw new Error(`Node process exited from signal ${result.signal}`)
  }

  return {
    exitCode: result.code ?? 1,
    stderr,
    stdout,
  }
}

function normalizeNodeError(stderr: string, projectPath: string): string {
  return stderr
    .replace(/\r\n/g, '\n')
    .replaceAll(`/private${projectPath}`, '<project>')
    .replaceAll(projectPath, '<project>')
    .replaceAll('<project>\\', '<project>/')
    .replace(/node:internal\/modules\/run_main:\d+/g, 'node:internal/modules/run_main:<line>')
    .replace(/Node\.js v[\d.]+/g, 'Node.js <version>')
}

async function waitForClose(
  child: ReturnType<typeof spawn>,
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  return await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code: number | null, signal: NodeJS.Signals | null) => {
      resolve({ code, signal })
    })
  })
}

async function linkRemixPackage(projectDir: string): Promise<void> {
  await fs.mkdir(path.join(projectDir, 'node_modules'), { recursive: true })
  await fs.symlink(REMIX_PACKAGE_PATH, path.join(projectDir, 'node_modules', 'remix'))
}

async function ensureBuiltNodeTsxPackage(): Promise<void> {
  if (builtNodeTsxPackage) {
    return
  }

  let npmExecPath = process.env.npm_execpath
  if (npmExecPath == null) {
    throw new Error('Expected npm_execpath to be set while running package tests')
  }

  let result = await runProcess(
    process.execPath,
    [npmExecPath, '--filter', '@remix-run/node-tsx', 'run', 'build'],
    ROOT_DIR,
  )
  assert.equal(result.exitCode, 0, result.stderr)
  assert.equal(result.stderr, '')
  builtNodeTsxPackage = true
}

async function writeJsxRuntime(projectDir: string): Promise<void> {
  await writeProjectFile(
    projectDir,
    'tsconfig.json',
    [
      '{',
      '  "compilerOptions": {',
      '    "jsx": "react-jsx",',
      '    "jsxImportSource": "jsx-package"',
      '  }',
      '}',
      '',
    ].join('\n'),
  )
  await writeProjectFile(
    projectDir,
    'node_modules/jsx-package/package.json',
    [
      '{',
      '  "name": "jsx-package",',
      '  "type": "module",',
      '  "exports": {',
      '    "./jsx-runtime": "./jsx-runtime.js"',
      '  }',
      '}',
      '',
    ].join('\n'),
  )
  await writeProjectFile(
    projectDir,
    'node_modules/jsx-package/jsx-runtime.js',
    [
      'export const Fragment = "Fragment"',
      '',
      'export function jsx(type, props) {',
      '  return { type, props: props ?? null }',
      '}',
      '',
      'export { jsx as jsxs }',
      '',
    ].join('\n'),
  )
}

async function writeProjectFile(
  projectDir: string,
  relativePath: string,
  contents: string,
): Promise<void> {
  let filePath = path.join(projectDir, relativePath)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, contents, 'utf8')
}

async function withProject(
  callback: (projectPath: string) => Promise<void>,
  options: { packageType?: 'commonjs' | 'module' } = {},
): Promise<void> {
  let projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-node-tsx-'))
  await writeProjectFile(
    projectPath,
    'package.json',
    ['{', `  "type": "${options.packageType ?? 'module'}"`, '}', ''].join('\n'),
  )

  try {
    await callback(projectPath)
  } finally {
    await fs.rm(projectPath, { recursive: true, force: true })
  }
}

async function withPackageLessProject(
  callback: (projectPath: string) => Promise<void>,
): Promise<void> {
  let projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-node-tsx-'))

  try {
    await callback(projectPath)
  } finally {
    await fs.rm(projectPath, { recursive: true, force: true })
  }
}
