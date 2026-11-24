import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { SourceMapConsumer, SourceMapGenerator } from 'source-map-js'

import { composeSourceMaps } from './source-maps.ts'

describe('composeSourceMaps', () => {
  it('preserves unmapped regions in the rewrite map', () => {
    let rewrite = new SourceMapGenerator()
    rewrite.addMapping({
      generated: { line: 1, column: 0 },
      original: { line: 1, column: 0 },
      source: 'intermediate.js',
    })
    rewrite.addMapping({ generated: { line: 1, column: 5 } })

    let upstream = new SourceMapGenerator()
    upstream.addMapping({
      generated: { line: 1, column: 0 },
      original: { line: 3, column: 4 },
      source: 'original.tsx',
    })

    let composed = new SourceMapConsumer(
      JSON.parse(composeSourceMaps(rewrite.toString(), upstream.toString())),
    )
    assert.deepEqual(composed.originalPositionFor({ line: 1, column: 0 }), {
      source: 'original.tsx',
      line: 3,
      column: 4,
      name: null,
    })
    assert.deepEqual(composed.originalPositionFor({ line: 1, column: 5 }), {
      source: null,
      line: null,
      column: null,
      name: null,
    })
    assert.deepEqual(composed.originalPositionFor({ line: 1, column: 9 }), {
      source: null,
      line: null,
      column: null,
      name: null,
    })
  })

  it('preserves unmapped regions in the upstream map', () => {
    let rewrite = new SourceMapGenerator()
    rewrite.addMapping({
      generated: { line: 1, column: 0 },
      original: { line: 1, column: 0 },
      source: 'intermediate.js',
    })
    rewrite.addMapping({
      generated: { line: 1, column: 5 },
      original: { line: 1, column: 5 },
      source: 'intermediate.js',
    })

    let upstream = new SourceMapGenerator()
    upstream.addMapping({
      generated: { line: 1, column: 0 },
      original: { line: 3, column: 4 },
      source: 'original.tsx',
    })
    upstream.addMapping({ generated: { line: 1, column: 5 } })

    let composed = new SourceMapConsumer(
      JSON.parse(composeSourceMaps(rewrite.toString(), upstream.toString())),
    )
    assert.deepEqual(composed.originalPositionFor({ line: 1, column: 5 }), {
      source: null,
      line: null,
      column: null,
      name: null,
    })
  })
})
