import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'

import { codegen, codegenCheck } from './codegen.ts'

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

async function writeDevTs(root: string, relPath: string, content: string) {
  let abs = path.join(root, ...relPath.split('/'))
  await fsp.mkdir(path.dirname(abs), { recursive: true })
  await fsp.writeFile(abs, content, 'utf-8')
}

// ---------------------------------------------------------------------------
// codegenCheck — ok when in sync
// ---------------------------------------------------------------------------

describe('codegenCheck', () => {
  it('returns ok:true when .dev.ts files exactly match generated output', async () => {
    let { root } = setup()
    try {
      await writeScript(root, 'app/entry.tsx')
      await codegen({ root, scripts: ['app/entry.tsx'] })

      let result = await codegenCheck({ root, scripts: ['app/entry.tsx'] })

      assert.equal(result.ok, true)
      assert.deepEqual(result.missing, [])
      assert.deepEqual(result.stale, [])
      assert.deepEqual(result.outdated, [])
    } finally {
      cleanup(root)
    }
  })

  it('returns ok:true for file assets when .dev.ts files exactly match', async () => {
    let { root } = setup()
    try {
      await writeScript(root, 'app/images/logo.png', 'fake-png')
      await codegen({
        root,
        files: [{ include: 'app/images/**/*.png', variants: { thumb: (d) => d } }],
      })

      let result = await codegenCheck({
        root,
        files: [{ include: 'app/images/**/*.png', variants: { thumb: (d) => d } }],
      })

      assert.equal(result.ok, true)
    } finally {
      cleanup(root)
    }
  })

  it('returns ok:true when there are no scripts or files configured and no .dev.ts files exist', async () => {
    let { root } = setup()
    try {
      let result = await codegenCheck({ root })
      assert.equal(result.ok, true)
    } finally {
      cleanup(root)
    }
  })

  // -------------------------------------------------------------------------
  // missing
  // -------------------------------------------------------------------------

  it('reports missing when a .dev.ts file has not been generated yet', async () => {
    let { root } = setup()
    try {
      await writeScript(root, 'app/entry.tsx')
      // Intentionally skip running codegen

      let result = await codegenCheck({ root, scripts: ['app/entry.tsx'] })

      assert.equal(result.ok, false)
      assert.equal(result.missing.length, 1)
      assert.ok(
        result.missing[0]?.includes('entry.tsx.dev.ts'),
        `Expected entry.tsx.dev.ts in missing, got: ${result.missing[0]}`,
      )
      assert.deepEqual(result.stale, [])
      assert.deepEqual(result.outdated, [])
    } finally {
      cleanup(root)
    }
  })

  it('does not report missing for a script whose source file does not exist', async () => {
    let { root } = setup()
    try {
      // Script listed but source file absent — codegen skips it, check should too
      let result = await codegenCheck({ root, scripts: ['app/nonexistent.tsx'] })

      assert.equal(result.ok, true)
      assert.deepEqual(result.missing, [])
    } finally {
      cleanup(root)
    }
  })

  // -------------------------------------------------------------------------
  // stale
  // -------------------------------------------------------------------------

  it('reports stale when a .dev.ts file exists but its source file has been deleted', async () => {
    let { root } = setup()
    try {
      await writeScript(root, 'app/entry.tsx')
      await codegen({ root, scripts: ['app/entry.tsx'] })

      // Simulate source deletion
      await fsp.unlink(path.join(root, 'app', 'entry.tsx'))

      let result = await codegenCheck({ root, scripts: ['app/entry.tsx'] })

      assert.equal(result.ok, false)
      assert.equal(result.stale.length, 1)
      assert.ok(
        result.stale[0]?.includes('entry.tsx.dev.ts'),
        `Expected entry.tsx.dev.ts in stale, got: ${result.stale[0]}`,
      )
      assert.deepEqual(result.missing, [])
      assert.deepEqual(result.outdated, [])
    } finally {
      cleanup(root)
    }
  })

  it('reports stale when a .dev.ts file exists but its rule has been removed from config', async () => {
    let { root } = setup()
    try {
      await writeScript(root, 'app/images/logo.png', 'fake-png')
      await codegen({
        root,
        files: [{ include: 'app/images/**/*.png', variants: { thumb: (d) => d } }],
      })

      // Check with empty files config — the .dev.ts no longer has a matching rule
      let result = await codegenCheck({ root, files: [] })

      assert.equal(result.ok, false)
      assert.equal(result.stale.length, 1)
      assert.ok(result.stale[0]?.includes('logo.png.dev.ts'))
    } finally {
      cleanup(root)
    }
  })

  // -------------------------------------------------------------------------
  // outdated
  // -------------------------------------------------------------------------

  it('reports outdated when a .dev.ts file exists but its content is wrong', async () => {
    let { root } = setup()
    try {
      await writeScript(root, 'app/entry.tsx')
      // Write a .dev.ts with stale/wrong content
      await writeDevTs(
        root,
        '.assets/app/entry.tsx.dev.ts',
        "// @generated by remix/assets — do not edit manually\nexport const href = '/old-path'\nexport const preloads = ['/old-path']\n",
      )

      let result = await codegenCheck({ root, scripts: ['app/entry.tsx'] })

      assert.equal(result.ok, false)
      assert.equal(result.outdated.length, 1)
      assert.ok(
        result.outdated[0]?.includes('entry.tsx.dev.ts'),
        `Expected entry.tsx.dev.ts in outdated, got: ${result.outdated[0]}`,
      )
      assert.deepEqual(result.missing, [])
      assert.deepEqual(result.stale, [])
    } finally {
      cleanup(root)
    }
  })

  it('reports outdated when file asset variants have changed', async () => {
    let { root } = setup()
    try {
      await writeScript(root, 'app/images/logo.png', 'fake-png')
      // Generate with one set of variants
      await codegen({
        root,
        files: [{ include: 'app/images/**/*.png', variants: { thumb: (d) => d } }],
      })

      // Now check with a different (expanded) variant set
      let result = await codegenCheck({
        root,
        files: [
          {
            include: 'app/images/**/*.png',
            variants: { thumb: (d) => d, card: (d) => d },
            defaultVariant: 'card',
          },
        ],
      })

      assert.equal(result.ok, false)
      assert.equal(result.outdated.length, 1)
      assert.ok(result.outdated[0]?.includes('logo.png.dev.ts'))
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
      await codegen({ root, scripts: ['app/a.tsx', 'app/b.tsx', 'app/c.tsx'] })

      // Delete source for b → its .dev.ts becomes stale
      await fsp.unlink(path.join(root, 'app', 'b.tsx'))

      // Corrupt the content of c's .dev.ts → outdated
      let cDevTs = path.join(root, '.assets', 'app', 'c.tsx.dev.ts')
      await fsp.writeFile(
        cDevTs,
        "// @generated by remix/assets — do not edit manually\nexport const href = '/wrong'\nexport const preloads = ['/wrong']\n",
        'utf-8',
      )

      // Check with a new script d that has no .dev.ts yet → missing
      await writeScript(root, 'app/d.tsx')

      let result = await codegenCheck({
        root,
        scripts: ['app/a.tsx', 'app/b.tsx', 'app/c.tsx', 'app/d.tsx'],
      })

      assert.equal(result.ok, false)
      assert.equal(result.missing.length, 1)
      assert.ok(result.missing[0]?.includes('d.tsx.dev.ts'))
      assert.equal(result.stale.length, 1)
      assert.ok(result.stale[0]?.includes('b.tsx.dev.ts'))
      assert.equal(result.outdated.length, 1)
      assert.ok(result.outdated[0]?.includes('c.tsx.dev.ts'))
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
      await codegen({ root, scripts: ['app/entry.tsx'], codegenDir: '.custom-assets' })

      let result = await codegenCheck({
        root,
        scripts: ['app/entry.tsx'],
        codegenDir: '.custom-assets',
      })

      assert.equal(result.ok, true)

      // Using the default dir should report missing (nothing was written there)
      let defaultResult = await codegenCheck({ root, scripts: ['app/entry.tsx'] })
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

      let result = await codegenCheck({ root, scripts: ['app/entry.tsx'] })

      assert.equal(result.missing.length, 1)
      assert.ok(
        !path.isAbsolute(result.missing[0]!),
        `Expected relative path, got absolute: ${result.missing[0]}`,
      )
    } finally {
      cleanup(root)
    }
  })
})
