import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'

import { codegenPlaceholders, checkCodegenPlaceholders, codegenBuild } from './codegen.ts'
import type { AssetsManifest } from './manifest-types.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup() {
  let root = fs.mkdtempSync(path.join(os.tmpdir(), 'codegen-test-'))
  return { root }
}

function cleanup(root: string) {
  fs.rmSync(root, { recursive: true, force: true })
}

async function writeScript(root: string, relPath: string, content = 'export {}') {
  let abs = path.join(root, ...relPath.split('/'))
  await fsp.mkdir(path.dirname(abs), { recursive: true })
  await fsp.writeFile(abs, content, 'utf-8')
}

async function writePlaceholderTs(root: string, relPath: string, content: string) {
  let abs = path.join(root, ...relPath.split('/'))
  await fsp.mkdir(path.dirname(abs), { recursive: true })
  await fsp.writeFile(abs, content, 'utf-8')
}

// ---------------------------------------------------------------------------
// checkCodegenPlaceholders — ok when in sync
// ---------------------------------------------------------------------------

describe('checkCodegenPlaceholders', () => {
  it('returns ok:true when .placeholder.ts files exactly match generated output', async () => {
    let { root } = setup()
    try {
      await writeScript(root, 'app/entry.tsx')
      await codegenPlaceholders({ root, source: { scripts: ['app/entry.tsx'] } })

      let result = await checkCodegenPlaceholders({ root, source: { scripts: ['app/entry.tsx'] } })

      assert.equal(result.ok, true)
      assert.deepEqual(result.missing, [])
      assert.deepEqual(result.stale, [])
      assert.deepEqual(result.outdated, [])
      assert.deepEqual(result.unknown, [])
    } finally {
      cleanup(root)
    }
  })

  it('returns ok:true for file assets when .placeholder.ts files exactly match', async () => {
    let { root } = setup()
    try {
      await writeScript(root, 'app/images/logo.png', 'fake-png')
      await codegenPlaceholders({
        root,
        source: { files: [{ include: 'app/images/**/*.png', variants: { thumb: (d) => d } }] },
      })

      let result = await checkCodegenPlaceholders({
        root,
        source: { files: [{ include: 'app/images/**/*.png', variants: { thumb: (d) => d } }] },
      })

      assert.equal(result.ok, true)
    } finally {
      cleanup(root)
    }
  })

  it('returns ok:true when there are no scripts or files configured and no .placeholder.ts files exist', async () => {
    let { root } = setup()
    try {
      let result = await checkCodegenPlaceholders({ root })
      assert.equal(result.ok, true)
    } finally {
      cleanup(root)
    }
  })

  // -------------------------------------------------------------------------
  // missing
  // -------------------------------------------------------------------------

  it('reports missing when a .placeholder.ts file has not been generated yet', async () => {
    let { root } = setup()
    try {
      await writeScript(root, 'app/entry.tsx')
      // Intentionally skip running codegenPlaceholders

      let result = await checkCodegenPlaceholders({ root, source: { scripts: ['app/entry.tsx'] } })

      assert.equal(result.ok, false)
      assert.equal(result.missing.length, 1)
      assert.ok(
        result.missing[0]?.includes('entry.tsx.placeholder.ts'),
        `Expected entry.tsx.placeholder.ts in missing, got: ${result.missing[0]}`,
      )
      assert.deepEqual(result.stale, [])
      assert.deepEqual(result.outdated, [])
      assert.deepEqual(result.unknown, [])
    } finally {
      cleanup(root)
    }
  })

  it('does not report missing for a script whose source file does not exist', async () => {
    let { root } = setup()
    try {
      // Script listed but source file absent — codegenPlaceholders skips it, check should too
      let result = await checkCodegenPlaceholders({
        root,
        source: { scripts: ['app/nonexistent.tsx'] },
      })

      assert.equal(result.ok, true)
      assert.deepEqual(result.missing, [])
    } finally {
      cleanup(root)
    }
  })

  // -------------------------------------------------------------------------
  // stale
  // -------------------------------------------------------------------------

  it('reports stale when a .placeholder.ts file exists but its source file has been deleted', async () => {
    let { root } = setup()
    try {
      await writeScript(root, 'app/entry.tsx')
      await codegenPlaceholders({ root, source: { scripts: ['app/entry.tsx'] } })

      // Simulate source deletion
      await fsp.unlink(path.join(root, 'app', 'entry.tsx'))

      let result = await checkCodegenPlaceholders({ root, source: { scripts: ['app/entry.tsx'] } })

      assert.equal(result.ok, false)
      assert.equal(result.stale.length, 1)
      assert.ok(
        result.stale[0]?.includes('entry.tsx.placeholder.ts'),
        `Expected entry.tsx.placeholder.ts in stale, got: ${result.stale[0]}`,
      )
      assert.deepEqual(result.missing, [])
      assert.deepEqual(result.outdated, [])
      assert.deepEqual(result.unknown, [])
    } finally {
      cleanup(root)
    }
  })

  it('reports stale when a .placeholder.ts file exists but its rule has been removed from config', async () => {
    let { root } = setup()
    try {
      await writeScript(root, 'app/images/logo.png', 'fake-png')
      await codegenPlaceholders({
        root,
        source: { files: [{ include: 'app/images/**/*.png', variants: { thumb: (d) => d } }] },
      })

      // Check with empty files config — the .placeholder.ts no longer has a matching rule
      let result = await checkCodegenPlaceholders({ root, source: { files: [] } })

      assert.equal(result.ok, false)
      assert.equal(result.stale.length, 1)
      assert.ok(result.stale[0]?.includes('logo.png.placeholder.ts'))
    } finally {
      cleanup(root)
    }
  })

  // -------------------------------------------------------------------------
  // outdated
  // -------------------------------------------------------------------------

  it('reports outdated when a .placeholder.ts file exists but its content is wrong', async () => {
    let { root } = setup()
    try {
      await writeScript(root, 'app/entry.tsx')
      // Write a .placeholder.ts with stale/wrong content
      await writePlaceholderTs(
        root,
        '.assets/app/entry.tsx.placeholder.ts',
        "// @generated by remix/assets — do not edit manually\nexport const href = '/__@assets/old-path'\nexport const preloads = ['/__@assets/old-path#preloads']\n",
      )

      let result = await checkCodegenPlaceholders({ root, source: { scripts: ['app/entry.tsx'] } })

      assert.equal(result.ok, false)
      assert.equal(result.outdated.length, 1)
      assert.ok(
        result.outdated[0]?.includes('entry.tsx.placeholder.ts'),
        `Expected entry.tsx.placeholder.ts in outdated, got: ${result.outdated[0]}`,
      )
      assert.deepEqual(result.missing, [])
      assert.deepEqual(result.stale, [])
      assert.deepEqual(result.unknown, [])
    } finally {
      cleanup(root)
    }
  })

  it('reports outdated when file asset variants have changed', async () => {
    let { root } = setup()
    try {
      await writeScript(root, 'app/images/logo.png', 'fake-png')
      // Generate with one set of variants
      await codegenPlaceholders({
        root,
        source: { files: [{ include: 'app/images/**/*.png', variants: { thumb: (d) => d } }] },
      })

      // Now check with a different (expanded) variant set
      let result = await checkCodegenPlaceholders({
        root,
        source: {
          files: [
            {
              include: 'app/images/**/*.png',
              variants: { thumb: (d) => d, card: (d) => d },
              defaultVariant: 'card',
            },
          ],
        },
      })

      assert.equal(result.ok, false)
      assert.equal(result.outdated.length, 1)
      assert.ok(result.outdated[0]?.includes('logo.png.placeholder.ts'))
    } finally {
      cleanup(root)
    }
  })

  // -------------------------------------------------------------------------
  // multiple issues at once
  // -------------------------------------------------------------------------

  it('can report missing, stale, and outdated simultaneously', async () => {
    let { root } = setup()
    try {
      // Set up three scripts
      await writeScript(root, 'app/a.tsx')
      await writeScript(root, 'app/b.tsx')
      await writeScript(root, 'app/c.tsx')
      await codegenPlaceholders({
        root,
        source: { scripts: ['app/a.tsx', 'app/b.tsx', 'app/c.tsx'] },
      })

      // Delete source for b → its .placeholder.ts becomes stale
      await fsp.unlink(path.join(root, 'app', 'b.tsx'))

      // Corrupt the content of c's .placeholder.ts → outdated
      let cPlaceholderTs = path.join(root, '.assets', 'app', 'c.tsx.placeholder.ts')
      await fsp.writeFile(
        cPlaceholderTs,
        "// @generated by remix/assets — do not edit manually\nexport const href = '/__@assets/wrong'\nexport const preloads = ['/__@assets/wrong#preloads']\n",
        'utf-8',
      )

      // Check with a new script d that has no .placeholder.ts yet → missing
      await writeScript(root, 'app/d.tsx')

      let result = await checkCodegenPlaceholders({
        root,
        source: { scripts: ['app/a.tsx', 'app/b.tsx', 'app/c.tsx', 'app/d.tsx'] },
      })

      assert.equal(result.ok, false)
      assert.equal(result.missing.length, 1)
      assert.ok(result.missing[0]?.includes('d.tsx.placeholder.ts'))
      assert.equal(result.stale.length, 1)
      assert.ok(result.stale[0]?.includes('b.tsx.placeholder.ts'))
      assert.equal(result.outdated.length, 1)
      assert.ok(result.outdated[0]?.includes('c.tsx.placeholder.ts'))
    } finally {
      cleanup(root)
    }
  })

  // -------------------------------------------------------------------------
  // custom codegenDir
  // -------------------------------------------------------------------------

  it('respects a custom codegenDir', async () => {
    let { root } = setup()
    try {
      await writeScript(root, 'app/entry.tsx')
      await codegenPlaceholders({
        root,
        source: { scripts: ['app/entry.tsx'] },
        codegenDir: '.custom-assets',
      })

      let result = await checkCodegenPlaceholders({
        root,
        source: { scripts: ['app/entry.tsx'] },
        codegenDir: '.custom-assets',
      })

      assert.equal(result.ok, true)

      // Using the default dir should report missing (nothing was written there)
      let defaultResult = await checkCodegenPlaceholders({
        root,
        source: { scripts: ['app/entry.tsx'] },
      })
      assert.equal(defaultResult.ok, false)
      assert.equal(defaultResult.missing.length, 1)
    } finally {
      cleanup(root)
    }
  })

  // -------------------------------------------------------------------------
  // returned paths are relative to root
  // -------------------------------------------------------------------------

  it('returns paths relative to root, not absolute', async () => {
    let { root } = setup()
    try {
      await writeScript(root, 'app/entry.tsx')

      let result = await checkCodegenPlaceholders({ root, source: { scripts: ['app/entry.tsx'] } })

      assert.equal(result.missing.length, 1)
      assert.ok(
        !path.isAbsolute(result.missing[0]!),
        `Expected relative path, got absolute: ${result.missing[0]}`,
      )
    } finally {
      cleanup(root)
    }
  })

  // -------------------------------------------------------------------------
  // unknown
  // -------------------------------------------------------------------------

  it('reports unknown when codegenDir contains a file that is not .placeholder.ts or .build.ts', async () => {
    let { root } = setup()
    try {
      await writeScript(root, 'app/entry.tsx')
      await codegenPlaceholders({ root, source: { scripts: ['app/entry.tsx'] } })

      // Plant an unexpected file in the codegenDir
      await writeScript(root, '.assets/foo.txt', 'oops')

      let result = await checkCodegenPlaceholders({ root, source: { scripts: ['app/entry.tsx'] } })

      assert.equal(result.ok, false)
      assert.equal(result.unknown.length, 1)
      assert.ok(result.unknown[0]?.includes('foo.txt'))
      assert.deepEqual(result.missing, [])
      assert.deepEqual(result.stale, [])
      assert.deepEqual(result.outdated, [])
    } finally {
      cleanup(root)
    }
  })

  it('does not report .build.ts files as unknown', async () => {
    let { root } = setup()
    try {
      await writeScript(root, 'app/entry.tsx')
      await codegenPlaceholders({ root, source: { scripts: ['app/entry.tsx'] } })

      // A .build.ts file is a legitimate codegen artifact
      await writeScript(
        root,
        '.assets/app/entry.tsx.build.ts',
        'export const href = "/assets/entry-ABC123.js"',
      )

      let result = await checkCodegenPlaceholders({ root, source: { scripts: ['app/entry.tsx'] } })

      assert.equal(result.ok, true)
      assert.deepEqual(result.unknown, [])
    } finally {
      cleanup(root)
    }
  })

  it('with allowUnknownFiles:true, unknown files do not affect ok', async () => {
    let { root } = setup()
    try {
      await writeScript(root, 'app/entry.tsx')
      await codegenPlaceholders({ root, source: { scripts: ['app/entry.tsx'] } })
      await writeScript(root, '.assets/foo.txt', 'oops')

      let result = await checkCodegenPlaceholders({
        root,
        source: { scripts: ['app/entry.tsx'] },
        allowUnknownFiles: true,
      })

      assert.equal(result.ok, true)
      assert.equal(result.unknown.length, 1)
    } finally {
      cleanup(root)
    }
  })
})

// ---------------------------------------------------------------------------
// codegenPlaceholders — generated content
// ---------------------------------------------------------------------------

describe('codegenPlaceholders', () => {
  it('generates /__@assets/ href for script entries', async () => {
    let { root } = setup()
    try {
      await writeScript(root, 'app/entry.tsx')
      await codegenPlaceholders({ root, source: { scripts: ['app/entry.tsx'] } })

      let content = await fsp.readFile(
        path.join(root, '.assets', 'app', 'entry.tsx.placeholder.ts'),
        'utf-8',
      )
      assert.ok(
        content.includes("export const href = '/__@assets/app/entry.tsx'"),
        `Expected /__@assets/ href, got:\n${content}`,
      )
    } finally {
      cleanup(root)
    }
  })

  it('generates #preloads fragment in preloads for script entries', async () => {
    let { root } = setup()
    try {
      await writeScript(root, 'app/entry.tsx')
      await codegenPlaceholders({ root, source: { scripts: ['app/entry.tsx'] } })

      let content = await fsp.readFile(
        path.join(root, '.assets', 'app', 'entry.tsx.placeholder.ts'),
        'utf-8',
      )
      assert.ok(
        content.includes("export const preloads = ['/__@assets/app/entry.tsx#preloads']"),
        `Expected #preloads fragment, got:\n${content}`,
      )
    } finally {
      cleanup(root)
    }
  })

  it('generates /__@assets/ href for file assets with variants', async () => {
    let { root } = setup()
    try {
      await writeScript(root, 'app/images/logo.png', 'fake-png')
      await codegenPlaceholders({
        root,
        source: {
          files: [{ include: 'app/images/**/*.png', variants: { thumb: (d) => d } }],
        },
      })

      let content = await fsp.readFile(
        path.join(root, '.assets', 'app', 'images', 'logo.png.placeholder.ts'),
        'utf-8',
      )
      assert.ok(
        content.includes('/__@assets/app/images/logo.png?@thumb'),
        `Expected /__@assets/ variant URL, got:\n${content}`,
      )
      assert.ok(
        !content.includes('/__@files/'),
        `Should not contain legacy /__@files/ prefix, got:\n${content}`,
      )
    } finally {
      cleanup(root)
    }
  })
})

// ---------------------------------------------------------------------------
// codegenBuild — script entries
// ---------------------------------------------------------------------------

describe('codegenBuild — script entries', () => {
  it('generates a .build.ts with hashed href for a script entry with no chunks', async () => {
    let { root } = setup()
    try {
      let manifest: AssetsManifest = {
        scripts: {
          outputs: {
            'entry-ABC123.js': { entryPoint: 'app/entry.tsx' },
          },
        },
        files: { outputs: {} },
      }
      await codegenBuild({ manifest, baseUrl: '/assets', root })

      let content = await fsp.readFile(
        path.join(root, '.assets', 'app', 'entry.tsx.build.ts'),
        'utf-8',
      )
      assert.ok(
        content.includes("export const href = '/assets/entry-ABC123.js'"),
        `Expected hashed href, got:\n${content}`,
      )
      assert.ok(
        content.includes("export const preloads = ['/assets/entry-ABC123.js']"),
        `Expected single preload, got:\n${content}`,
      )
    } finally {
      cleanup(root)
    }
  })

  it('includes the GENERATED_MARKER and source comment in .build.ts', async () => {
    let { root } = setup()
    try {
      let manifest: AssetsManifest = {
        scripts: {
          outputs: {
            'entry-ABC123.js': { entryPoint: 'app/entry.tsx' },
          },
        },
        files: { outputs: {} },
      }
      await codegenBuild({ manifest, baseUrl: '/assets', root })

      let content = await fsp.readFile(
        path.join(root, '.assets', 'app', 'entry.tsx.build.ts'),
        'utf-8',
      )
      assert.ok(
        content.includes('// @generated by remix/assets — do not edit manually'),
        `Expected GENERATED_MARKER, got:\n${content}`,
      )
      assert.ok(
        content.includes('// source: app/entry.tsx'),
        `Expected source comment, got:\n${content}`,
      )
    } finally {
      cleanup(root)
    }
  })

  it('expands preloads to include direct chunk imports', async () => {
    let { root } = setup()
    try {
      let manifest: AssetsManifest = {
        scripts: {
          outputs: {
            'entry-ABC123.js': {
              entryPoint: 'app/entry.tsx',
              imports: [{ path: 'chunks/shared-DEF456.js', kind: 'import-statement' }],
            },
            'chunks/shared-DEF456.js': {},
          },
        },
        files: { outputs: {} },
      }
      await codegenBuild({ manifest, baseUrl: '/assets', root })

      let content = await fsp.readFile(
        path.join(root, '.assets', 'app', 'entry.tsx.build.ts'),
        'utf-8',
      )
      assert.ok(
        content.includes("'/assets/entry-ABC123.js'"),
        `Expected entry in preloads, got:\n${content}`,
      )
      assert.ok(
        content.includes("'/assets/chunks/shared-DEF456.js'"),
        `Expected chunk in preloads, got:\n${content}`,
      )
    } finally {
      cleanup(root)
    }
  })

  it('traverses transitive chunk imports depth-first', async () => {
    let { root } = setup()
    try {
      let manifest: AssetsManifest = {
        scripts: {
          outputs: {
            'entry-A.js': {
              entryPoint: 'app/entry.tsx',
              imports: [{ path: 'chunks/chunk-B.js', kind: 'import-statement' }],
            },
            'chunks/chunk-B.js': {
              imports: [{ path: 'chunks/chunk-C.js', kind: 'import-statement' }],
            },
            'chunks/chunk-C.js': {},
          },
        },
        files: { outputs: {} },
      }
      await codegenBuild({ manifest, baseUrl: '/assets', root })

      let content = await fsp.readFile(
        path.join(root, '.assets', 'app', 'entry.tsx.build.ts'),
        'utf-8',
      )
      // Depth-first: entry → chunk-B → chunk-C
      let entryPos = content.indexOf('/assets/entry-A.js')
      let chunkBPos = content.indexOf('/assets/chunks/chunk-B.js')
      let chunkCPos = content.indexOf('/assets/chunks/chunk-C.js')
      assert.ok(entryPos < chunkBPos, 'entry should appear before chunk-B in preloads')
      assert.ok(chunkBPos < chunkCPos, 'chunk-B should appear before chunk-C in preloads')
    } finally {
      cleanup(root)
    }
  })

  it('does not repeat a shared chunk that appears in multiple import paths', async () => {
    let { root } = setup()
    try {
      // entry imports chunk-A and chunk-B; both import chunk-shared
      let manifest: AssetsManifest = {
        scripts: {
          outputs: {
            'entry-X.js': {
              entryPoint: 'app/entry.tsx',
              imports: [
                { path: 'chunks/chunk-A.js', kind: 'import-statement' },
                { path: 'chunks/chunk-B.js', kind: 'import-statement' },
              ],
            },
            'chunks/chunk-A.js': {
              imports: [{ path: 'chunks/shared.js', kind: 'import-statement' }],
            },
            'chunks/chunk-B.js': {
              imports: [{ path: 'chunks/shared.js', kind: 'import-statement' }],
            },
            'chunks/shared.js': {},
          },
        },
        files: { outputs: {} },
      }
      await codegenBuild({ manifest, baseUrl: '/assets', root })

      let content = await fsp.readFile(
        path.join(root, '.assets', 'app', 'entry.tsx.build.ts'),
        'utf-8',
      )
      // shared.js should appear exactly once
      let count = (content.match(/chunks\/shared\.js/g) ?? []).length
      assert.equal(count, 1, `Expected shared chunk to appear once, got ${count} occurrences`)
    } finally {
      cleanup(root)
    }
  })

  it('does not loop infinitely when chunks have circular imports', async () => {
    let { root } = setup()
    try {
      let manifest: AssetsManifest = {
        scripts: {
          outputs: {
            'entry-X.js': {
              entryPoint: 'app/entry.tsx',
              imports: [{ path: 'chunks/chunk-A.js', kind: 'import-statement' }],
            },
            'chunks/chunk-A.js': {
              imports: [{ path: 'chunks/chunk-B.js', kind: 'import-statement' }],
            },
            'chunks/chunk-B.js': {
              // cycles back to chunk-A
              imports: [{ path: 'chunks/chunk-A.js', kind: 'import-statement' }],
            },
          },
        },
        files: { outputs: {} },
      }
      // Should complete without hanging
      await codegenBuild({ manifest, baseUrl: '/assets', root })

      let content = await fsp.readFile(
        path.join(root, '.assets', 'app', 'entry.tsx.build.ts'),
        'utf-8',
      )
      let chunkACount = (content.match(/chunks\/chunk-A\.js/g) ?? []).length
      assert.equal(chunkACount, 1, 'chunk-A should appear exactly once despite cycle')
    } finally {
      cleanup(root)
    }
  })

  it('generates separate .build.ts files for each entry point', async () => {
    let { root } = setup()
    try {
      let manifest: AssetsManifest = {
        scripts: {
          outputs: {
            'entry-A.js': { entryPoint: 'app/entry-a.tsx' },
            'entry-B.js': { entryPoint: 'app/entry-b.tsx' },
          },
        },
        files: { outputs: {} },
      }
      await codegenBuild({ manifest, baseUrl: '/assets', root })

      let contentA = await fsp.readFile(
        path.join(root, '.assets', 'app', 'entry-a.tsx.build.ts'),
        'utf-8',
      )
      let contentB = await fsp.readFile(
        path.join(root, '.assets', 'app', 'entry-b.tsx.build.ts'),
        'utf-8',
      )
      assert.ok(contentA.includes('/assets/entry-A.js'), `entry-a.tsx.build.ts missing href`)
      assert.ok(contentB.includes('/assets/entry-B.js'), `entry-b.tsx.build.ts missing href`)
    } finally {
      cleanup(root)
    }
  })

  it('two entries sharing a chunk each have the chunk in their own preloads', async () => {
    let { root } = setup()
    try {
      let manifest: AssetsManifest = {
        scripts: {
          outputs: {
            'entry-A.js': {
              entryPoint: 'app/entry-a.tsx',
              imports: [{ path: 'chunks/shared.js', kind: 'import-statement' }],
            },
            'entry-B.js': {
              entryPoint: 'app/entry-b.tsx',
              imports: [{ path: 'chunks/shared.js', kind: 'import-statement' }],
            },
            'chunks/shared.js': {},
          },
        },
        files: { outputs: {} },
      }
      await codegenBuild({ manifest, baseUrl: '/assets', root })

      let contentA = await fsp.readFile(
        path.join(root, '.assets', 'app', 'entry-a.tsx.build.ts'),
        'utf-8',
      )
      let contentB = await fsp.readFile(
        path.join(root, '.assets', 'app', 'entry-b.tsx.build.ts'),
        'utf-8',
      )
      assert.ok(contentA.includes('/assets/chunks/shared.js'), `entry-a missing shared chunk`)
      assert.ok(contentB.includes('/assets/chunks/shared.js'), `entry-b missing shared chunk`)
    } finally {
      cleanup(root)
    }
  })

  it('does not generate a .build.ts for non-entry chunk outputs', async () => {
    let { root } = setup()
    try {
      let manifest: AssetsManifest = {
        scripts: {
          outputs: {
            'entry-A.js': {
              entryPoint: 'app/entry.tsx',
              imports: [{ path: 'chunks/vendor-XYZ.js', kind: 'import-statement' }],
            },
            'chunks/vendor-XYZ.js': {},
          },
        },
        files: { outputs: {} },
      }
      await codegenBuild({ manifest, baseUrl: '/assets', root })

      let codegenDir = path.join(root, '.assets')
      let allFiles = fs.readdirSync(codegenDir, { recursive: true }) as string[]
      let buildFiles = allFiles.filter((f) => f.endsWith('.build.ts'))
      assert.equal(buildFiles.length, 1, `Expected 1 .build.ts, got: ${buildFiles.join(', ')}`)
      assert.ok(buildFiles[0]?.includes('entry.tsx.build.ts'), `Expected entry.tsx.build.ts`)
    } finally {
      cleanup(root)
    }
  })

  it('uses baseUrl prefix in all generated URLs', async () => {
    let { root } = setup()
    try {
      let manifest: AssetsManifest = {
        scripts: {
          outputs: {
            'entry-ABC.js': {
              entryPoint: 'app/entry.tsx',
              imports: [{ path: 'chunks/chunk-DEF.js', kind: 'import-statement' }],
            },
            'chunks/chunk-DEF.js': {},
          },
        },
        files: { outputs: {} },
      }
      await codegenBuild({ manifest, baseUrl: '/static/js', root })

      let content = await fsp.readFile(
        path.join(root, '.assets', 'app', 'entry.tsx.build.ts'),
        'utf-8',
      )
      assert.ok(content.includes('/static/js/entry-ABC.js'), `Expected baseUrl in href`)
      assert.ok(content.includes('/static/js/chunks/chunk-DEF.js'), `Expected baseUrl in preload`)
    } finally {
      cleanup(root)
    }
  })

  it('handles an empty baseUrl (root-relative URLs)', async () => {
    let { root } = setup()
    try {
      let manifest: AssetsManifest = {
        scripts: {
          outputs: {
            'entry-ABC.js': { entryPoint: 'app/entry.tsx' },
          },
        },
        files: { outputs: {} },
      }
      await codegenBuild({ manifest, baseUrl: '', root })

      let content = await fsp.readFile(
        path.join(root, '.assets', 'app', 'entry.tsx.build.ts'),
        'utf-8',
      )
      assert.ok(
        content.includes("export const href = '/entry-ABC.js'"),
        `Expected root-relative URL, got:\n${content}`,
      )
    } finally {
      cleanup(root)
    }
  })

  it('respects a custom codegenDir', async () => {
    let { root } = setup()
    try {
      let manifest: AssetsManifest = {
        scripts: {
          outputs: {
            'entry-ABC.js': { entryPoint: 'app/entry.tsx' },
          },
        },
        files: { outputs: {} },
      }
      await codegenBuild({ manifest, baseUrl: '/assets', root, codegenDir: '.build-stubs' })

      let content = await fsp.readFile(
        path.join(root, '.build-stubs', 'app', 'entry.tsx.build.ts'),
        'utf-8',
      )
      assert.ok(content.includes('/assets/entry-ABC.js'), `Expected href in custom dir`)

      // Default .assets dir should be empty
      assert.ok(!fs.existsSync(path.join(root, '.assets')), 'Default .assets dir should not exist')
    } finally {
      cleanup(root)
    }
  })

  it('uses multiline format for preloads when there are multiple URLs', async () => {
    let { root } = setup()
    try {
      let manifest: AssetsManifest = {
        scripts: {
          outputs: {
            'entry-A.js': {
              entryPoint: 'app/entry.tsx',
              imports: [{ path: 'chunks/chunk-B.js', kind: 'import-statement' }],
            },
            'chunks/chunk-B.js': {},
          },
        },
        files: { outputs: {} },
      }
      await codegenBuild({ manifest, baseUrl: '/assets', root })

      let content = await fsp.readFile(
        path.join(root, '.assets', 'app', 'entry.tsx.build.ts'),
        'utf-8',
      )
      // Multiline array format: opening bracket on same line, each URL on its own line
      assert.ok(content.includes('[\n'), `Expected multiline preloads array, got:\n${content}`)
    } finally {
      cleanup(root)
    }
  })

  it('does not rewrite .build.ts when content is unchanged (idempotent)', async () => {
    let { root } = setup()
    try {
      let manifest: AssetsManifest = {
        scripts: {
          outputs: {
            'entry-ABC.js': { entryPoint: 'app/entry.tsx' },
          },
        },
        files: { outputs: {} },
      }
      await codegenBuild({ manifest, baseUrl: '/assets', root })

      let filePath = path.join(root, '.assets', 'app', 'entry.tsx.build.ts')
      let { mtimeMs: mtime1 } = fs.statSync(filePath)

      // Small delay to ensure mtime would differ if file was written
      await new Promise((resolve) => setTimeout(resolve, 10))
      await codegenBuild({ manifest, baseUrl: '/assets', root })

      let { mtimeMs: mtime2 } = fs.statSync(filePath)
      assert.equal(mtime1, mtime2, 'File should not be rewritten when content is unchanged')
    } finally {
      cleanup(root)
    }
  })
})

// ---------------------------------------------------------------------------
// codegenBuild — file entries
// ---------------------------------------------------------------------------

describe('codegenBuild — file entries', () => {
  it('generates a .build.ts with href for a simple file (no variants)', async () => {
    let { root } = setup()
    try {
      let manifest: AssetsManifest = {
        scripts: { outputs: {} },
        files: {
          outputs: {
            'app/images/logo.png': { path: 'app/images/logo-ABC123.png' },
          },
        },
      }
      await codegenBuild({ manifest, baseUrl: '/assets', root })

      let content = await fsp.readFile(
        path.join(root, '.assets', 'app', 'images', 'logo.png.build.ts'),
        'utf-8',
      )
      assert.ok(
        content.includes("export const href = '/assets/app/images/logo-ABC123.png'"),
        `Expected hashed href, got:\n${content}`,
      )
    } finally {
      cleanup(root)
    }
  })

  it('generates a .build.ts with variants object for a file with variants', async () => {
    let { root } = setup()
    try {
      let manifest: AssetsManifest = {
        scripts: { outputs: {} },
        files: {
          outputs: {
            'app/images/photo.png': {
              variants: {
                thumbnail: { path: 'app/images/photo-@thumbnail-AAA.jpg' },
                card: { path: 'app/images/photo-@card-BBB.jpg' },
              },
            },
          },
        },
      }
      await codegenBuild({ manifest, baseUrl: '/assets', root })

      let content = await fsp.readFile(
        path.join(root, '.assets', 'app', 'images', 'photo.png.build.ts'),
        'utf-8',
      )
      assert.ok(
        content.includes("thumbnail: { href: '/assets/app/images/photo-@thumbnail-AAA.jpg' }"),
        `Expected thumbnail variant href, got:\n${content}`,
      )
      assert.ok(
        content.includes("card: { href: '/assets/app/images/photo-@card-BBB.jpg' }"),
        `Expected card variant href, got:\n${content}`,
      )
    } finally {
      cleanup(root)
    }
  })

  it('generates a default href when a file has variants and a defaultVariant', async () => {
    let { root } = setup()
    try {
      let manifest: AssetsManifest = {
        scripts: { outputs: {} },
        files: {
          outputs: {
            'app/images/photo.png': {
              variants: {
                thumbnail: { path: 'app/images/photo-@thumbnail-AAA.jpg' },
                card: { path: 'app/images/photo-@card-BBB.jpg' },
              },
              defaultVariant: 'card',
            },
          },
        },
      }
      await codegenBuild({ manifest, baseUrl: '/assets', root })

      let content = await fsp.readFile(
        path.join(root, '.assets', 'app', 'images', 'photo.png.build.ts'),
        'utf-8',
      )
      assert.ok(
        content.includes("export const href = '/assets/app/images/photo-@card-BBB.jpg'"),
        `Expected default href from defaultVariant, got:\n${content}`,
      )
      assert.ok(
        content.includes("thumbnail: { href: '/assets/app/images/photo-@thumbnail-AAA.jpg' }"),
        `Expected thumbnail in variants, got:\n${content}`,
      )
    } finally {
      cleanup(root)
    }
  })

  it('does not generate a top-level href when there are variants but no defaultVariant', async () => {
    let { root } = setup()
    try {
      let manifest: AssetsManifest = {
        scripts: { outputs: {} },
        files: {
          outputs: {
            'app/images/photo.png': {
              variants: {
                thumbnail: { path: 'app/images/photo-@thumbnail-AAA.jpg' },
              },
            },
          },
        },
      }
      await codegenBuild({ manifest, baseUrl: '/assets', root })

      let content = await fsp.readFile(
        path.join(root, '.assets', 'app', 'images', 'photo.png.build.ts'),
        'utf-8',
      )
      assert.ok(
        !content.includes('export const href'),
        `Expected no top-level href without defaultVariant, got:\n${content}`,
      )
      assert.ok(content.includes('export const variants'), `Expected variants export`)
    } finally {
      cleanup(root)
    }
  })

  it('includes the GENERATED_MARKER and source comment in file .build.ts', async () => {
    let { root } = setup()
    try {
      let manifest: AssetsManifest = {
        scripts: { outputs: {} },
        files: {
          outputs: {
            'app/images/logo.png': { path: 'app/images/logo-ABC.png' },
          },
        },
      }
      await codegenBuild({ manifest, baseUrl: '/assets', root })

      let content = await fsp.readFile(
        path.join(root, '.assets', 'app', 'images', 'logo.png.build.ts'),
        'utf-8',
      )
      assert.ok(content.includes('// @generated by remix/assets — do not edit manually'))
      assert.ok(content.includes('// source: app/images/logo.png'))
    } finally {
      cleanup(root)
    }
  })

  it('applies baseUrl prefix to file variant URLs', async () => {
    let { root } = setup()
    try {
      let manifest: AssetsManifest = {
        scripts: { outputs: {} },
        files: {
          outputs: {
            'app/images/logo.png': {
              variants: {
                thumb: { path: 'app/images/logo-@thumb-XYZ.jpg' },
              },
              defaultVariant: 'thumb',
            },
          },
        },
      }
      await codegenBuild({ manifest, baseUrl: '/static', root })

      let content = await fsp.readFile(
        path.join(root, '.assets', 'app', 'images', 'logo.png.build.ts'),
        'utf-8',
      )
      assert.ok(
        content.includes('/static/app/images/logo-@thumb-XYZ.jpg'),
        `Expected baseUrl in variant href, got:\n${content}`,
      )
    } finally {
      cleanup(root)
    }
  })

  it('generates separate .build.ts files for each file source path', async () => {
    let { root } = setup()
    try {
      let manifest: AssetsManifest = {
        scripts: { outputs: {} },
        files: {
          outputs: {
            'app/images/logo.png': { path: 'app/images/logo-AAA.png' },
            'app/images/banner.png': { path: 'app/images/banner-BBB.png' },
          },
        },
      }
      await codegenBuild({ manifest, baseUrl: '/assets', root })

      let logoContent = await fsp.readFile(
        path.join(root, '.assets', 'app', 'images', 'logo.png.build.ts'),
        'utf-8',
      )
      let bannerContent = await fsp.readFile(
        path.join(root, '.assets', 'app', 'images', 'banner.png.build.ts'),
        'utf-8',
      )
      assert.ok(logoContent.includes('/assets/app/images/logo-AAA.png'))
      assert.ok(bannerContent.includes('/assets/app/images/banner-BBB.png'))
    } finally {
      cleanup(root)
    }
  })
})

// ---------------------------------------------------------------------------
// codegenBuild — scripts and files together
// ---------------------------------------------------------------------------

describe('codegenBuild — scripts and files together', () => {
  it('generates .build.ts for both script entries and file outputs in one call', async () => {
    let { root } = setup()
    try {
      let manifest: AssetsManifest = {
        scripts: {
          outputs: {
            'entry-ABC.js': { entryPoint: 'app/entry.tsx' },
          },
        },
        files: {
          outputs: {
            'app/images/logo.png': { path: 'app/images/logo-XYZ.png' },
          },
        },
      }
      await codegenBuild({ manifest, baseUrl: '/assets', root })

      let scriptContent = await fsp.readFile(
        path.join(root, '.assets', 'app', 'entry.tsx.build.ts'),
        'utf-8',
      )
      let fileContent = await fsp.readFile(
        path.join(root, '.assets', 'app', 'images', 'logo.png.build.ts'),
        'utf-8',
      )
      assert.ok(scriptContent.includes('/assets/entry-ABC.js'))
      assert.ok(fileContent.includes('/assets/app/images/logo-XYZ.png'))
    } finally {
      cleanup(root)
    }
  })

  it('produces no .build.ts files when manifest has no entries', async () => {
    let { root } = setup()
    try {
      let manifest: AssetsManifest = {
        scripts: { outputs: {} },
        files: { outputs: {} },
      }
      await codegenBuild({ manifest, baseUrl: '/assets', root })

      let codegenDir = path.join(root, '.assets')
      assert.ok(!fs.existsSync(codegenDir), 'codegenDir should not be created for empty manifest')
    } finally {
      cleanup(root)
    }
  })
})
