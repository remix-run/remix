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
        scripts: ['entry.ts'],
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
        scripts: ['entry.ts'],
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
        scripts: ['main.ts'],
        root,
        outDir,
        fileNames: '[name]',
        manifest: manifestPath,
      })

      let manifestFull = path.join(root, manifestPath)
      let raw = await fsp.readFile(manifestFull, 'utf-8')
      let manifest = JSON.parse(raw)

      assert.ok(manifest.scripts?.outputs, 'manifest has scripts outputs')
      let entryOutput = Object.entries(manifest.scripts.outputs).find(
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
        scripts: ['entry.ts'],
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
        scripts: ['app/entry.ts'],
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

  it('hash in file names includes path so same name+content in different dirs get different hashes', async () => {
    let root = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-build-hash-path-'))
    try {
      fs.mkdirSync(path.join(root, 'app'), { recursive: true })
      fs.mkdirSync(path.join(root, 'lib'), { recursive: true })
      let sameContent = `export const x = 1`
      fs.writeFileSync(path.join(root, 'app', 'util.ts'), sameContent)
      fs.writeFileSync(path.join(root, 'lib', 'util.ts'), sameContent)
      fs.writeFileSync(
        path.join(root, 'entry.ts'),
        `import './app/util.ts'\nimport './lib/util.ts'\nexport {}`,
      )

      await build({
        scripts: ['entry.ts'],
        root,
        outDir: './out',
        fileNames: '[name]-[hash]',
        manifest: false,
      })

      let outPath = path.join(root, 'out')
      let files = await fsp.readdir(outPath)
      let utilFiles = files.filter((f) => f.startsWith('util-') && f.endsWith('.js'))
      assert.equal(utilFiles.length, 2, 'two util-*.js files (one per dir, different hashes)')
      let hashes = utilFiles.map((f) => f.replace(/^util-|\.js$/g, ''))
      assert.notEqual(
        hashes[0],
        hashes[1],
        'hashes must differ when path differs (same name and content)',
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
        scripts: ['entry.ts'],
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
        scripts: ['entry.ts'],
        root,
        outDir: './out',
        fileNames: '[name]',
        manifest: false,
        sourcemap: 'external',
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
        scripts: ['entry.ts'],
        root,
        outDir: './out',
        fileNames: '[name]',
        manifest: false,
        sourcemap: 'inline',
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

  it('with sourcemap: "external" (alternate) emits .map files', async () => {
    let root = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-build-sourcemap-external-alt-'))
    try {
      fs.writeFileSync(path.join(root, 'entry.ts'), `export const x = 1`)

      await build({
        scripts: ['entry.ts'],
        root,
        outDir: './out',
        fileNames: '[name]',
        manifest: false,
        sourcemap: 'external',
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

  it('preserves sourceRoot in emitted map', async () => {
    let root = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-build-sourcemap-sourceroot-'))
    try {
      fs.writeFileSync(path.join(root, 'entry.ts'), `export const x = 1`)

      await build({
        scripts: ['entry.ts'],
        root,
        outDir: './out',
        fileNames: '[name]',
        manifest: false,
        sourcemap: 'external',
        sourceRoot: 'https://example.com/sources/',
      })

      let mapContent = await fsp.readFile(path.join(root, 'out', 'entry.js.map'), 'utf-8')
      let map = JSON.parse(mapContent)
      assert.equal(map.sourceRoot, 'https://example.com/sources/')
      assert.ok(Array.isArray(map.sources))
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('module graph and manifest include all deps (entry with multiple imports)', async () => {
    let root = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-build-manifest-deps-'))
    try {
      fs.writeFileSync(path.join(root, 'shim.js'), `export const tag = 'shim'`)
      fs.writeFileSync(
        path.join(root, 'entry.ts'),
        `import { tag } from './shim.js'
import { helper } from './helper.ts'
export const out = tag + helper`,
      )
      fs.writeFileSync(path.join(root, 'helper.ts'), `export const helper = 'ok'`)

      await build({
        scripts: ['entry.ts'],
        root,
        outDir: './out',
        fileNames: '[name]',
        manifest: './out/manifest.json',
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
      assert.ok(manifest.scripts.outputs['entry.js'], 'entry in manifest')
      assert.ok(manifest.scripts.outputs['shim.js'], 'shim in manifest')
      assert.ok(manifest.scripts.outputs['helper.js'], 'helper in manifest')
      assert.equal(
        manifest.scripts.outputs['entry.js'].imports?.length,
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

  it('empties outDir by default before writing', async () => {
    let root = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-build-empty-out-'))
    try {
      fs.writeFileSync(path.join(root, 'entry.ts'), `export const x = 1`)
      let outPath = path.join(root, 'out')
      await fsp.mkdir(outPath, { recursive: true })
      fs.writeFileSync(path.join(outPath, 'leftover.txt'), 'should be removed')

      await build({
        scripts: ['entry.ts'],
        root,
        outDir: './out',
        fileNames: '[name]',
        manifest: false,
      })

      let files = await fsp.readdir(outPath)
      assert.ok(files.includes('entry.js'), 'build output should exist')
      assert.ok(!files.includes('leftover.txt'), 'outDir should be emptied by default')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('when emptyOutDir: false preserves existing files not overwritten by build', async () => {
    let root = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-build-no-empty-'))
    try {
      fs.writeFileSync(path.join(root, 'entry.ts'), `export const x = 1`)
      let outPath = path.join(root, 'out')
      await fsp.mkdir(outPath, { recursive: true })
      let preservedPath = path.join(outPath, 'preserved.txt')
      fs.writeFileSync(preservedPath, 'must remain')

      await build({
        scripts: ['entry.ts'],
        root,
        outDir: './out',
        fileNames: '[name]',
        manifest: false,
        emptyOutDir: false,
      })

      let files = await fsp.readdir(outPath)
      assert.ok(files.includes('entry.js'), 'build output should exist')
      assert.ok(files.includes('preserved.txt'), 'existing file should be preserved')
      assert.equal(
        await fsp.readFile(preservedPath, 'utf-8'),
        'must remain',
        'preserved file content unchanged',
      )
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('when outDir is absolute but within root default emptyOutDir is true', async () => {
    let root = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-build-abs-in-'))
    try {
      fs.writeFileSync(path.join(root, 'entry.ts'), `export const x = 1`)
      let outPath = path.join(root, 'out')
      await fsp.mkdir(outPath, { recursive: true })
      fs.writeFileSync(path.join(outPath, 'leftover.txt'), 'should be removed')

      await build({
        scripts: ['entry.ts'],
        root,
        outDir: outPath,
        fileNames: '[name]',
        manifest: false,
      })

      let files = await fsp.readdir(outPath)
      assert.ok(files.includes('entry.js'), 'build output should exist')
      assert.ok(!files.includes('leftover.txt'), 'outDir within root should be emptied by default')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('when outDir is outside root default emptyOutDir is false (do not wipe external dir)', async () => {
    let parent = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-build-parent-'))
    try {
      let root = path.join(parent, 'project')
      let outDir = path.join(parent, 'output')
      await fsp.mkdir(root, { recursive: true })
      await fsp.mkdir(outDir, { recursive: true })
      fs.writeFileSync(path.join(root, 'entry.ts'), `export const x = 1`)
      let externalPath = path.join(outDir, 'external-file.txt')
      fs.writeFileSync(externalPath, 'do not remove')

      await build({
        scripts: ['entry.ts'],
        root,
        outDir: path.relative(root, outDir),
        fileNames: '[name]',
        manifest: false,
      })

      let files = await fsp.readdir(outDir)
      assert.ok(files.includes('entry.js'), 'build output should exist')
      assert.ok(
        files.includes('external-file.txt'),
        'external dir should not be emptied by default',
      )
      assert.equal(await fsp.readFile(externalPath, 'utf-8'), 'do not remove')
    } finally {
      fs.rmSync(parent, { recursive: true, force: true })
    }
  })

  it('builds file variants and writes files manifest outputs', async () => {
    let root = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-build-files-'))
    try {
      await fsp.mkdir(path.join(root, 'app', 'images'), { recursive: true })
      await fsp.writeFile(path.join(root, 'app', 'entry.ts'), 'export const x = 1')
      await fsp.writeFile(path.join(root, 'app', 'images', 'logo.txt'), 'logo')

      await build({
        scripts: ['app/entry.ts'],
        root,
        outDir: './out',
        fileNames: '[name]',
        manifest: './out/manifest.json',
        files: [
          {
            include: 'app/images/**/*.txt',
            variants: {
              small: (data) => Buffer.from(data.toString('utf-8').toUpperCase()),
              large: (data) => Buffer.from(`${data.toString('utf-8')}!`),
            },
            defaultVariant: 'small',
          },
        ],
      })

      let manifest = JSON.parse(
        await fsp.readFile(path.join(root, 'out', 'manifest.json'), 'utf-8'),
      )
      let logo = manifest.files.outputs['app/images/logo.txt']
      assert.ok(logo, 'manifest should include file output')
      assert.equal(logo.defaultVariant, 'small')
      assert.ok(logo.variants.small.path.endsWith('.txt'))
      assert.ok(logo.variants.large.path.endsWith('.txt'))

      let smallOutput = await fsp.readFile(
        path.join(root, 'out', logo.variants.small.path),
        'utf-8',
      )
      let largeOutput = await fsp.readFile(
        path.join(root, 'out', logo.variants.large.path),
        'utf-8',
      )
      assert.equal(smallOutput, 'LOGO')
      assert.equal(largeOutput, 'logo!')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
