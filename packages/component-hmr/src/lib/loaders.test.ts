import * as assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, it } from 'node:test'

import { createAssetsComponentHmrLoader, createServerComponentHmrModuleHooks } from './loaders.ts'

describe('component-hmr module loading', () => {
  it('transforms browser modules with an asset loader', async () => {
    let fixture = await createFixture({
      'node_modules/remix/package.json': JSON.stringify({
        exports: {
          './component/dev/refresh': './component/dev/refresh.js',
          './component-hmr/runtime/browser': './component-hmr/runtime/browser.js',
        },
        name: 'remix',
        type: 'module',
      }),
      'node_modules/remix/component/dev/refresh.js': 'export {}',
      'node_modules/remix/component-hmr/runtime/browser.js': 'export {}',
    })

    try {
      let loader = createAssetsComponentHmrLoader()
      let result = loader(
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

      assert.equal(result.format, 'module')
      let source = getStringSource(result)
      assert.match(source, /from "remix\/component-hmr\/runtime\/browser"/)
      assert.match(source, /from "remix\/component\/dev\/refresh"/)
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
      'node_modules/@remix-run/component/package.json': JSON.stringify({
        exports: {
          './dev/refresh': './dev/refresh.js',
        },
        name: '@remix-run/component',
        type: 'module',
      }),
      'node_modules/@remix-run/component/dev/refresh.js': 'export {}',
      'node_modules/@remix-run/component-hmr/package.json': JSON.stringify({
        exports: {
          './runtime/browser': './runtime/browser.js',
        },
        name: '@remix-run/component-hmr',
        type: 'module',
      }),
      'node_modules/@remix-run/component-hmr/runtime/browser.js': 'export {}',
    })

    try {
      let loader = createAssetsComponentHmrLoader()
      let result = loader(
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
      assert.match(source, /from "@remix-run\/component-hmr\/runtime\/browser"/)
      assert.match(source, /from "@remix-run\/component\/dev\/refresh"/)
    } finally {
      await fixture.close()
    }
  })

  it('transforms server modules', async () => {
    let fixture = await createFixture({
      'node_modules/remix/package.json': JSON.stringify({
        exports: {
          './component-hmr/runtime/server': './component-hmr/runtime/server.js',
        },
        name: 'remix',
        type: 'module',
      }),
      'node_modules/remix/component-hmr/runtime/server.js': 'export {}',
    })

    try {
      let hooks = createServerComponentHmrModuleHooks()
      let result = hooks.load(
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
      assert.match(source, /from "remix\/component-hmr\/runtime\/server"/)
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
            './component-hmr/runtime/server': './component-hmr/runtime/server.js',
          },
          name: 'remix',
          type: 'module',
        }),
        'component-hmr/runtime/server.js': 'export {}',
      })

      let hooks = createServerComponentHmrModuleHooks()
      let result = hooks.load(
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
      assert.match(source, /from "remix\/component-hmr\/runtime\/server"/)
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
  let rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'component-hmr-loaders-'))
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
