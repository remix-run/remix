import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { transformSync } from 'esbuild'

import { resolveScriptTarget, resolveStyleTarget } from './target.ts'
import type { AssetTarget } from './target.ts'

describe('resolveScriptTarget', () => {
  it('accepts top-level browser and ECMAScript targets', () => {
    let target = resolveScriptTarget({
      chrome: '109',
      safari: '16.4',
      es: '2020',
    })

    assert.deepEqual(target, ['es2020', 'chrome109', 'safari16.4'])
  })

  it('accepts numeric es targets', () => {
    let target = resolveScriptTarget({
      es: '2020',
    })

    assert.deepEqual(target, ['es2020'])
  })

  it('returns supported script targets that can be passed to esbuild', () => {
    let result = transformSync(
      'const data: { nested?: number } | null = { nested: 1 }\nexport let value = data?.nested ?? 0\n',
      {
        format: 'esm',
        loader: 'ts',
        sourcefile: 'entry.ts',
        target: resolveScriptTarget({
          chrome: '79',
        }),
      },
    )

    assert.doesNotMatch(result.code, /\?\?|\?\./)
  })

  it('rejects unsupported target keys', () => {
    assert.throws(
      () =>
        resolveScriptTarget({
          android: '120',
        } as unknown as AssetTarget),
      /target\.android is not a supported target/,
    )
  })

  it('rejects version ranges', () => {
    assert.throws(
      () =>
        resolveScriptTarget({
          ios: '18.5-18.7',
        } as unknown as AssetTarget),
      /target\.ios must use "X", "X\.Y", or "X\.Y\.Z" version format/,
    )
  })

  it('rejects empty es target values', () => {
    assert.throws(
      () =>
        resolveScriptTarget({
          es: '   ',
        }),
      /target\.es must be a non-empty string/,
    )
  })

  it('rejects prefixed es target values', () => {
    assert.throws(
      () =>
        resolveScriptTarget({
          es: 'es2020',
        }),
      /target\.es must use a single numeric year like "2020"/,
    )
  })

  it('rejects es target values below 2015', () => {
    assert.throws(
      () =>
        resolveScriptTarget({
          es: '2014',
        }),
      /target\.es must use a four-digit year of 2015 or higher/,
    )
  })

  it('rejects shorthand es target values like "6"', () => {
    assert.throws(
      () =>
        resolveScriptTarget({
          es: '6',
        }),
      /target\.es must use a four-digit year of 2015 or higher/,
    )
  })
})

describe('resolveStyleTarget', () => {
  it('maps ios to ios_saf and ignores target.es', () => {
    let target = resolveStyleTarget({
      es: '2020',
      ios: '15.6',
      safari: '16.4',
    })

    assert.deepEqual(target, {
      ios_saf: (15 << 16) | (6 << 8),
      safari: (16 << 16) | (4 << 8),
    })
  })
})
