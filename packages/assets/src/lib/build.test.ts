import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'

import { build } from './build.ts'
import { extractImportSpecifiers } from './import-rewriter.ts'

describe('build', () => {
  it('rewrites all in-graph imports to relative paths (no dev-style URLs left)', async () => {
    let root = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-build-test-'))
    try {
      let outDir = './out'

      fs.writeFileSync(
        path.join(root, 'entry.ts'),
        `import { x } from './a.ts'
export const root = x`,
      )
      fs.writeFileSync(
        path.join(root, 'a.ts'),
        `import { y } from './b.ts'
export const x = 1 + y`,
      )
      fs.writeFileSync(
        path.join(root, 'b.ts'),
        `import { x } from './a.ts'
export const y = 2 + x`,
      )

      await build({
        entryPoints: ['entry.ts'],
        root,
        outDir,
        fileNames: '[name]',
        manifest: false,
      })

      let outPath = path.join(root, outDir)
      let entries = await fsp.readdir(outPath, { withFileTypes: true })
      let jsFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.js')).map((e) => e.name)

      assert.ok(jsFiles.length >= 3, 'expected at least entry.js, a.js, b.js')

      for (let name of jsFiles) {
        let content = await fsp.readFile(path.join(outPath, name), 'utf-8')
        let specifiers = await extractImportSpecifiers(content)
        for (let { specifier } of specifiers) {
          assert.ok(
            specifier.startsWith('./') || specifier.startsWith('../'),
            `Built file ${name} should have relative import (got "${specifier}")`,
          )
        }
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('handles import cycles (both sides get relative imports)', async () => {
    let root = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-build-cycles-'))
    try {
      fs.writeFileSync(
        path.join(root, 'entry.ts'),
        `import { foo } from './alpha.ts'
export const out = foo`,
      )
      fs.writeFileSync(
        path.join(root, 'alpha.ts'),
        `import { bar } from './beta.ts'
export const foo = 'a' + bar`,
      )
      fs.writeFileSync(
        path.join(root, 'beta.ts'),
        `import { foo } from './alpha.ts'
export const bar = 'b' + foo`,
      )

      await build({
        entryPoints: ['entry.ts'],
        root,
        outDir: './out',
        fileNames: '[name]',
        manifest: false,
      })

      let outPath = path.join(root, 'out')
      let aContent = await fsp.readFile(path.join(outPath, 'alpha.js'), 'utf-8')
      let bContent = await fsp.readFile(path.join(outPath, 'beta.js'), 'utf-8')

      let aImports = await extractImportSpecifiers(aContent)
      let bImports = await extractImportSpecifiers(bContent)
      assert.ok(aImports.length >= 1, 'alpha.js imports something')
      assert.ok(bImports.length >= 1, 'beta.js imports something')
      assert.ok(
        aImports.some((i) => i.specifier.startsWith('./') && i.specifier.includes('beta')),
        'alpha imports beta via relative path',
      )
      assert.ok(
        bImports.some((i) => i.specifier.startsWith('./') && i.specifier.includes('alpha')),
        'beta imports alpha via relative path',
      )
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('emits manifest with entryPoint and imports when manifest path is set', async () => {
    let root = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-build-manifest-'))
    try {
      let outDir = './dist'
      let manifestPath = './dist/assets-manifest.json'

      fs.writeFileSync(
        path.join(root, 'main.ts'),
        `import { helper } from './helper.ts'
export const main = helper`,
      )
      fs.writeFileSync(path.join(root, 'helper.ts'), `export const helper = 1`)

      await build({
        entryPoints: ['main.ts'],
        root,
        outDir,
        fileNames: '[name]',
        manifest: manifestPath,
      })

      let manifestFull = path.join(root, manifestPath)
      let raw = await fsp.readFile(manifestFull, 'utf-8')
      let manifest = JSON.parse(raw)

      assert.ok(manifest.outputs, 'manifest has outputs')
      let entryOutput = Object.entries(manifest.outputs).find(
        ([_, v]) => (v as { entryPoint?: string }).entryPoint === 'main.ts',
      )
      assert.ok(entryOutput, 'manifest has entry point main.ts')
      let [outputKey, entryMeta] = entryOutput
      assert.equal(
        outputKey,
        'main.js',
        'manifest uses locally-scoped output keys (relative to outDir)',
      )
      assert.ok((entryMeta as { entryPoint: string }).entryPoint === 'main.ts')
      assert.ok(Array.isArray((entryMeta as { imports?: unknown }).imports))
      let importPath = (entryMeta as { imports?: Array<{ path: string }> }).imports?.[0]?.path
      assert.equal(importPath, 'helper.js', 'manifest import paths are locally scoped')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('uses default fileNames [name]-[hash] when fileNames not set', async () => {
    let root = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-build-default-names-'))
    try {
      fs.writeFileSync(path.join(root, 'entry.ts'), `export const x = 1`)

      await build({
        entryPoints: ['entry.ts'],
        root,
        outDir: './out',
        manifest: false,
      })

      let outPath = path.join(root, 'out')
      let files = await fsp.readdir(outPath)
      assert.equal(files.length, 1)
      assert.ok(
        /^entry-[a-z0-9]{8}\.js$/.test(files[0]!),
        `expected entry-<hash>.js, got ${files[0]}`,
      )
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('applies fileNames template with [dir], [name], [hash]', async () => {
    let root = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-build-template-'))
    try {
      fs.mkdirSync(path.join(root, 'app'), { recursive: true })
      fs.writeFileSync(path.join(root, 'app', 'entry.ts'), `export const x = 1`)

      await build({
        entryPoints: ['app/entry.ts'],
        root,
        outDir: './out',
        fileNames: '[dir]/[name]-[hash]',
        manifest: false,
      })

      let outPath = path.join(root, 'out')
      let files = await fsp.readdir(outPath)
      assert.equal(files.length, 1, 'one top-level dir: app')
      assert.equal(files[0], 'app')
      let appFiles = await fsp.readdir(path.join(outPath, 'app'))
      assert.equal(appFiles.length, 1)
      assert.ok(
        /^entry-[a-z0-9]{8}\.js$/.test(appFiles[0]!),
        `expected app/entry-<hash>.js, got app/${appFiles[0]}`,
      )
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('does not emit source maps by default', async () => {
    let root = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-build-no-sourcemap-'))
    try {
      fs.writeFileSync(path.join(root, 'entry.ts'), `export const x = 1`)

      await build({
        entryPoints: ['entry.ts'],
        root,
        outDir: './out',
        fileNames: '[name]',
        manifest: false,
      })

      let outPath = path.join(root, 'out')
      let files = await fsp.readdir(outPath)
      assert.equal(files.length, 1, 'only one .js file, no .map')
      assert.ok(files[0]!.endsWith('.js'))
      let content = await fsp.readFile(path.join(outPath, files[0]!), 'utf-8')
      assert.ok(!content.includes('sourceMappingURL'), 'output should not contain source map')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('with sourcemap: "external" emits .map files and sourceMappingURL comment', async () => {
    let root = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-build-sourcemap-external-'))
    try {
      fs.writeFileSync(path.join(root, 'entry.ts'), `export const x = 1`)

      await build({
        entryPoints: ['entry.ts'],
        root,
        outDir: './out',
        fileNames: '[name]',
        manifest: false,
        esbuildConfig: { sourcemap: 'external' },
      })

      let outPath = path.join(root, 'out')
      let files = await fsp.readdir(outPath)
      assert.equal(files.length, 2, 'entry.js and entry.js.map')
      assert.ok(files.includes('entry.js'))
      assert.ok(files.includes('entry.js.map'))
      let jsContent = await fsp.readFile(path.join(outPath, 'entry.js'), 'utf-8')
      assert.ok(jsContent.includes('sourceMappingURL=entry.js.map'))
      let mapContent = await fsp.readFile(path.join(outPath, 'entry.js.map'), 'utf-8')
      let map = JSON.parse(mapContent)
      assert.equal(map.version, 3)
      assert.ok(Array.isArray(map.sources))
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('with sourcemap: "inline" embeds source map in output', async () => {
    let root = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-build-sourcemap-inline-'))
    try {
      fs.writeFileSync(path.join(root, 'entry.ts'), `export const x = 1`)

      await build({
        entryPoints: ['entry.ts'],
        root,
        outDir: './out',
        fileNames: '[name]',
        manifest: false,
        esbuildConfig: { sourcemap: 'inline' },
      })

      let outPath = path.join(root, 'out')
      let files = await fsp.readdir(outPath)
      assert.equal(files.length, 1, 'no separate .map file')
      let content = await fsp.readFile(path.join(outPath, 'entry.js'), 'utf-8')
      assert.ok(
        content.includes('sourceMappingURL=data:application/json;base64,'),
        'output should have inline source map',
      )
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('with sourcemap: true emits .map files (same as external)', async () => {
    let root = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-build-sourcemap-true-'))
    try {
      fs.writeFileSync(path.join(root, 'entry.ts'), `export const x = 1`)

      await build({
        entryPoints: ['entry.ts'],
        root,
        outDir: './out',
        fileNames: '[name]',
        manifest: false,
        esbuildConfig: { sourcemap: true },
      })

      let outPath = path.join(root, 'out')
      let files = await fsp.readdir(outPath)
      assert.equal(files.length, 2)
      assert.ok(files.includes('entry.js.map'))
      let jsContent = await fsp.readFile(path.join(outPath, 'entry.js'), 'utf-8')
      assert.ok(jsContent.includes('sourceMappingURL=entry.js.map'))
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('with sourcemap: "linked" emits .map files (same as external)', async () => {
    let root = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-build-sourcemap-linked-'))
    try {
      fs.writeFileSync(path.join(root, 'entry.ts'), `export const x = 1`)

      await build({
        entryPoints: ['entry.ts'],
        root,
        outDir: './out',
        fileNames: '[name]',
        manifest: false,
        esbuildConfig: { sourcemap: 'linked' },
      })

      let outPath = path.join(root, 'out')
      let files = await fsp.readdir(outPath)
      assert.equal(files.length, 2)
      assert.ok(files.includes('entry.js.map'))
      let jsContent = await fsp.readFile(path.join(outPath, 'entry.js'), 'utf-8')
      assert.ok(jsContent.includes('sourceMappingURL=entry.js.map'))
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('with sourcemap: "both" emits inline map and .map file', async () => {
    let root = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-build-sourcemap-both-'))
    try {
      fs.writeFileSync(path.join(root, 'entry.ts'), `export const x = 1`)

      await build({
        entryPoints: ['entry.ts'],
        root,
        outDir: './out',
        fileNames: '[name]',
        manifest: false,
        esbuildConfig: { sourcemap: 'both' },
      })

      let outPath = path.join(root, 'out')
      let files = await fsp.readdir(outPath)
      assert.equal(files.length, 2)
      assert.ok(files.includes('entry.js'))
      assert.ok(files.includes('entry.js.map'))
      let jsContent = await fsp.readFile(path.join(outPath, 'entry.js'), 'utf-8')
      assert.ok(
        jsContent.includes('sourceMappingURL=data:application/json;base64,'),
        'has inline map',
      )
      assert.ok(jsContent.includes('sourceMappingURL=entry.js.map'), 'has external map comment')
      let mapContent = await fsp.readFile(path.join(outPath, 'entry.js.map'), 'utf-8')
      assert.ok(JSON.parse(mapContent).sources)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('preserves sourceRoot from esbuildConfig in emitted map', async () => {
    let root = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-build-sourcemap-sourceroot-'))
    try {
      fs.writeFileSync(path.join(root, 'entry.ts'), `export const x = 1`)

      await build({
        entryPoints: ['entry.ts'],
        root,
        outDir: './out',
        fileNames: '[name]',
        manifest: false,
        esbuildConfig: { sourcemap: 'external', sourceRoot: 'https://example.com/sources/' },
      })

      let mapContent = await fsp.readFile(path.join(root, 'out', 'entry.js.map'), 'utf-8')
      let map = JSON.parse(mapContent)
      assert.equal(map.sourceRoot, 'https://example.com/sources/')
      assert.ok(Array.isArray(map.sources))
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('with inject (global) build succeeds and provides the global', async () => {
    let root = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-build-inject-'))
    try {
      let shimPath = path.join(root, 'shim.js')
      fs.writeFileSync(shimPath, `export const __INJECTED__ = 'from-shim'`)
      fs.writeFileSync(
        path.join(root, 'entry.ts'),
        `// Bare global - no import; inject provides it
export const x = typeof __INJECTED__ !== 'undefined' ? __INJECTED__ : 'missing'`,
      )

      await build({
        entryPoints: ['entry.ts'],
        root,
        outDir: './out',
        fileNames: '[name]',
        manifest: false,
        esbuildConfig: { inject: [shimPath] },
      })

      let outPath = path.join(root, 'out')
      let files = await fsp.readdir(outPath)
      assert.ok(files.length >= 1, 'at least entry emitted')
      let entryContent = await fsp.readFile(path.join(outPath, 'entry.js'), 'utf-8')
      assert.ok(entryContent.includes('from-shim'), 'inject should provide the global')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('inject does not break module graph or manifest (external always *)', async () => {
    let root = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-build-inject-manifest-'))
    try {
      let shimPath = path.join(root, 'shim.js')
      fs.writeFileSync(shimPath, `export const tag = 'shim'`)
      fs.writeFileSync(
        path.join(root, 'entry.ts'),
        `import { tag } from './shim.js'
import { helper } from './helper.ts'
export const out = tag + helper`,
      )
      fs.writeFileSync(path.join(root, 'helper.ts'), `export const helper = 'ok'`)

      await build({
        entryPoints: ['entry.ts'],
        root,
        outDir: './out',
        fileNames: '[name]',
        manifest: './out/manifest.json',
        esbuildConfig: { inject: [shimPath] },
      })

      let outPath = path.join(root, 'out')
      let files = await fsp.readdir(outPath)
      let jsFiles = files.filter((f) => f.endsWith('.js'))
      assert.equal(jsFiles.length, 3, 'entry, shim, helper emitted 1:1')
      assert.ok(
        jsFiles.includes('entry.js') &&
          jsFiles.includes('shim.js') &&
          jsFiles.includes('helper.js'),
        'all three modules in build output',
      )

      let manifest = JSON.parse(
        await fsp.readFile(path.join(root, 'out', 'manifest.json'), 'utf-8'),
      )
      assert.ok(manifest.outputs['entry.js'], 'entry in manifest')
      assert.ok(manifest.outputs['shim.js'], 'shim in manifest')
      assert.ok(manifest.outputs['helper.js'], 'helper in manifest')
      assert.equal(
        manifest.outputs['entry.js'].imports?.length,
        2,
        'entry should list both shim and helper',
      )

      let entryContent = await fsp.readFile(path.join(root, 'out', 'entry.js'), 'utf-8')
      assert.ok(
        entryContent.includes('tag') && entryContent.includes('helper'),
        'entry references both deps',
      )

      let shimContent = await fsp.readFile(path.join(root, 'out', 'shim.js'), 'utf-8')
      assert.ok(shimContent.includes('shim'), 'shim.js in build output with expected export')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
