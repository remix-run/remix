import { spawn } from 'node:child_process'
import * as assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as process from 'node:process'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const REMIX_PACKAGE_PATH = path.join(ROOT_DIR, 'packages', 'remix')

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
          '    "jsxImportSource": "local-jsx"',
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
          '    "jsxImportSource": "local-jsx",',
          '    "module": "CommonJS",',
          '    "paths": {',
          '      "local-jsx/jsx-runtime": ["./missing-jsx-runtime.js"]',
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

  it('preserves CommonJS format for tsx modules in CommonJS packages', async () => {
    await withProject(
      async (projectPath) => {
        await linkRemixPackage(projectPath)
        await writeProjectFile(
          projectPath,
          'tsconfig.json',
          ['{', '  "compilerOptions": {', '    "jsx": "react"', '  }', '}', ''].join('\n'),
        )
        await writeProjectFile(
          projectPath,
          'server.tsx',
          [
            'globalThis.React = {',
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
          ['{', '  "compilerOptions": {', '    "jsx": "react"', '  }', '}', ''].join('\n'),
        )
        await writeProjectFile(
          projectPath,
          'server.jsx',
          [
            'globalThis.React = {',
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
  let child = spawn(process.execPath, argv, {
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

async function writeJsxRuntime(projectDir: string): Promise<void> {
  await writeProjectFile(
    projectDir,
    'tsconfig.json',
    [
      '{',
      '  "compilerOptions": {',
      '    "jsx": "react-jsx",',
      '    "jsxImportSource": "local-jsx"',
      '  }',
      '}',
      '',
    ].join('\n'),
  )
  await writeProjectFile(
    projectDir,
    'node_modules/local-jsx/package.json',
    [
      '{',
      '  "name": "local-jsx",',
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
    'node_modules/local-jsx/jsx-runtime.js',
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
