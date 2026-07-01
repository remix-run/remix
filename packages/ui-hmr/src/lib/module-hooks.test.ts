import * as assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, it } from 'node:test'

import { createBrowserUiHmrModuleHooks, createServerUiHmrModuleHooks } from './module-hooks.ts'

describe('ui-hmr module hooks', () => {
  it('transforms browser modules with load hooks only', async () => {
    let fixture = await createFixture({
      'node_modules/remix/package.json': JSON.stringify({
        exports: {
          './ui/dev/refresh': './ui/dev/refresh.js',
          './ui-hmr/browser-runtime': './ui-hmr/browser-runtime.js',
        },
        name: 'remix',
        type: 'module',
      }),
      'node_modules/remix/ui/dev/refresh.js': 'export {}',
      'node_modules/remix/ui-hmr/browser-runtime.js': 'export {}',
    })

    try {
      let hooks = createBrowserUiHmrModuleHooks()
      assert.equal(Object.hasOwn(hooks, 'resolve'), false)

      let result = hooks.load?.(
        pathToFileURL(fixture.entryPath).href,
        {
          conditions: ['browser', 'import', 'module', 'default'],
          format: 'module',
          importAttributes: {},
          moduleUrl: '/assets/app/Counter.tsx',
        },
        () => ({
          format: 'module',
          source: componentSource,
        }),
      )

      assert.equal(result?.format, 'module')
      let source = getStringSource(result)
      assert.match(source, /from "remix\/ui-hmr\/browser-runtime"/)
      assert.match(source, /from "remix\/ui\/dev\/refresh"/)
    } finally {
      await fixture.close()
    }
  })

  it('falls back to lower-level browser imports during load', async () => {
    let fixture = await createFixture({
      'node_modules/remix/package.json': JSON.stringify({
        exports: {
          './package.json': './package.json',
        },
        name: 'remix',
        type: 'module',
      }),
      'node_modules/@remix-run/ui/package.json': JSON.stringify({
        exports: {
          './dev/refresh': './dev/refresh.js',
        },
        name: '@remix-run/ui',
        type: 'module',
      }),
      'node_modules/@remix-run/ui/dev/refresh.js': 'export {}',
      'node_modules/@remix-run/ui-hmr/package.json': JSON.stringify({
        exports: {
          './browser-runtime': './browser-runtime.js',
        },
        name: '@remix-run/ui-hmr',
        type: 'module',
      }),
      'node_modules/@remix-run/ui-hmr/browser-runtime.js': 'export {}',
    })

    try {
      let hooks = createBrowserUiHmrModuleHooks()
      let result = hooks.load?.(
        pathToFileURL(fixture.entryPath).href,
        {
          conditions: ['browser', 'import', 'module', 'default'],
          format: 'module',
          importAttributes: {},
          moduleUrl: '/assets/app/Counter.tsx',
        },
        () => ({
          format: 'module',
          source: componentSource,
        }),
      )

      let source = getStringSource(result)
      assert.match(source, /from "@remix-run\/ui-hmr\/browser-runtime"/)
      assert.match(source, /from "@remix-run\/ui\/dev\/refresh"/)
    } finally {
      await fixture.close()
    }
  })

  it('transforms server modules with load hooks only', async () => {
    let fixture = await createFixture({
      'node_modules/remix/package.json': JSON.stringify({
        exports: {
          './ui-hmr/server-runtime': './ui-hmr/server-runtime.js',
        },
        name: 'remix',
        type: 'module',
      }),
      'node_modules/remix/ui-hmr/server-runtime.js': 'export {}',
    })

    try {
      let hooks = createServerUiHmrModuleHooks()
      assert.equal(Object.hasOwn(hooks, 'resolve'), false)

      let result = hooks.load?.(
        pathToFileURL(fixture.entryPath).href,
        {
          conditions: ['node', 'import', 'module', 'default'],
          format: 'module',
          importAttributes: {},
        },
        () => ({
          format: 'module',
          source: componentSource,
        }),
      )

      let source = getStringSource(result)
      assert.match(source, /from "remix\/ui-hmr\/server-runtime"/)
    } finally {
      await fixture.close()
    }
  })

  it('detects a symlinked remix package during server loads', async () => {
    let fixture = await createFixture({})

    try {
      await writeSymlinkedPackage(fixture.rootDir, 'remix', {
        'package.json': JSON.stringify({
          exports: {
            './package.json': './package.json',
            './ui-hmr/server-runtime': './ui-hmr/server-runtime.js',
          },
          name: 'remix',
          type: 'module',
        }),
        'ui-hmr/server-runtime.js': 'export {}',
      })

      let hooks = createServerUiHmrModuleHooks()
      let result = hooks.load?.(
        pathToFileURL(fixture.entryPath).href,
        {
          conditions: ['node', 'import', 'module', 'default'],
          format: 'module',
          importAttributes: {},
        },
        () => ({
          format: 'module',
          source: componentSource,
        }),
      )

      let source = getStringSource(result)
      assert.match(source, /from "remix\/ui-hmr\/server-runtime"/)
    } finally {
      await fixture.close()
    }
  })
})

const componentSource = `export function Counter() {
  return () => "Count"
}
`

async function createFixture(files: Record<string, string>): Promise<{
  close(): Promise<void>
  entryPath: string
  rootDir: string
}> {
  let rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ui-hmr-module-hooks-'))
  let entryPath = path.join(rootDir, 'app/Counter.tsx')
  await write(path.dirname(entryPath), path.basename(entryPath), componentSource)

  for (let [filePath, contents] of Object.entries(files)) {
    await write(rootDir, filePath, contents)
  }

  return {
    async close() {
      await fs.rm(rootDir, { force: true, recursive: true })
    },
    entryPath,
    rootDir,
  }
}

async function writeSymlinkedPackage(
  rootDir: string,
  packageName: string,
  files: Record<string, string>,
): Promise<void> {
  let packagePath = path.join(rootDir, 'linked', packageName)
  for (let [filePath, contents] of Object.entries(files)) {
    await write(packagePath, filePath, contents)
  }

  let linkPath = path.join(rootDir, 'node_modules', packageName)
  await fs.mkdir(path.dirname(linkPath), { recursive: true })
  await fs.symlink(packagePath, linkPath, process.platform === 'win32' ? 'junction' : 'dir')
}

async function write(rootDir: string, relativePath: string, contents: string): Promise<void> {
  let filePath = path.join(rootDir, relativePath)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, contents)
}

function getStringSource(result: { source?: unknown } | undefined): string {
  if (typeof result?.source !== 'string') {
    throw new TypeError('Expected transformed source')
  }

  return result.source
}
