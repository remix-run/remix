import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import {
  resolveAndComposeImportMap,
  resolveIfNotPlainOrUrl,
  resolveImportMap,
  resolveUrl,
} from './resolve.ts'

function createImportMap() {
  return { imports: {}, scopes: {}, integrity: {} }
}

describe('import map resolution', () => {
  it('resolves URL and package mappings against their import map base URL', () => {
    let map = resolveAndComposeImportMap(
      {
        imports: {
          './feature.js': './feature.hash.js',
          'pkg/': './vendor/pkg/',
        },
      },
      'https://example.com/app/index.html',
      createImportMap(),
    )

    assert.equal(
      resolveImportMap(
        map,
        'https://example.com/app/feature.js',
        'https://example.com/app/main.js',
      ),
      'https://example.com/app/feature.hash.js',
    )
    assert.equal(
      resolveImportMap(map, 'pkg/component.js', 'https://example.com/app/main.js'),
      'https://example.com/app/vendor/pkg/component.js',
    )
  })

  it('uses the most specific matching scope before top-level imports', () => {
    let map = resolveAndComposeImportMap(
      {
        imports: { pkg: './default.js' },
        scopes: {
          './features/': { pkg: './feature.js' },
          './features/nested/': { pkg: './nested.js' },
        },
      },
      'https://example.com/app/',
      createImportMap(),
    )

    assert.equal(
      resolveImportMap(map, 'pkg', 'https://example.com/app/features/nested/entry.js'),
      'https://example.com/app/nested.js',
    )
    assert.equal(
      resolveImportMap(map, 'pkg', 'https://example.com/app/features/entry.js'),
      'https://example.com/app/feature.js',
    )
    assert.equal(
      resolveImportMap(map, 'pkg', 'https://example.com/app/other.js'),
      'https://example.com/app/default.js',
    )
  })

  it('does not mutate scopes from an earlier composed map', () => {
    let initial = resolveAndComposeImportMap(
      { scopes: { './feature.js': { first: './first.js' } } },
      'https://example.com/app/',
      createImportMap(),
    )
    let composed = resolveAndComposeImportMap(
      { scopes: { './feature.js': { second: './second.js' } } },
      'https://example.com/app/',
      initial,
    )
    let scope = 'https://example.com/app/feature.js'

    assert.deepEqual(initial.scopes[scope], {
      first: 'https://example.com/app/first.js',
    })
    assert.deepEqual(composed.scopes[scope], {
      first: 'https://example.com/app/first.js',
      second: 'https://example.com/app/second.js',
    })
  })

  it('keeps existing mappings when later maps try to replace them', (t) => {
    t.mock.method(console, 'warn', () => {})
    let initial = resolveAndComposeImportMap(
      { imports: { pkg: './first.js' } },
      'https://example.com/app/',
      createImportMap(),
    )
    let composed = resolveAndComposeImportMap(
      { imports: { pkg: './second.js' } },
      'https://example.com/app/',
      initial,
    )

    assert.equal(
      resolveImportMap(composed, 'pkg', 'https://example.com/app/entry.js'),
      'https://example.com/app/first.js',
    )
  })

  it('resolves relative, root-relative, protocol-relative, and absolute URLs', () => {
    let parentUrl = 'https://example.com/app/entry.js?query#hash'

    assert.equal(
      resolveIfNotPlainOrUrl('./feature.js', parentUrl),
      'https://example.com/app/feature.js',
    )
    assert.equal(resolveIfNotPlainOrUrl('/feature.js', parentUrl), 'https://example.com/feature.js')
    assert.equal(
      resolveUrl('//cdn.example.com/feature.js', parentUrl),
      'https://cdn.example.com/feature.js',
    )
    assert.equal(
      resolveUrl('https://cdn.example.com/feature.js', parentUrl),
      'https://cdn.example.com/feature.js',
    )
    assert.equal(resolveIfNotPlainOrUrl('package', parentUrl), undefined)
  })
})
