import assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { getPreviewTarballUrl, preparePreviewPackage } from './preview.ts'

describe('preview packages', () => {
  it('uses a distinct URL for each source commit on a moving branch', () => {
    assert.equal(
      getPreviewTarballUrl('preview/pr-123', 'abc123', 'remix'),
      'https://raw.githubusercontent.com/remix-run/remix/refs/heads/preview/pr-123/tarballs/abc123/remix.tgz',
    )
    assert.notEqual(
      getPreviewTarballUrl('preview/pr-123', 'abc123', 'remix'),
      getPreviewTarballUrl('preview/pr-123', 'def456', 'remix'),
    )
  })

  it('rewrites internal runtime dependencies while preserving external and peer ranges', () => {
    let url = getPreviewTarballUrl('preview/main', 'abc123', 'headers')
    let pkg = preparePreviewPackage(
      {
        name: 'remix',
        dependencies: { '@remix-run/headers': 'workspace:^', external: '^1.0.0' },
        optionalDependencies: { '@remix-run/headers': 'workspace:^' },
        peerDependencies: { '@remix-run/headers': '^1.0.0' },
      },
      new Map([['@remix-run/headers', url]]),
    )
    assert.deepEqual(pkg.dependencies, { '@remix-run/headers': url, external: '^1.0.0' })
    assert.deepEqual(pkg.optionalDependencies, { '@remix-run/headers': url })
    assert.deepEqual(pkg.peerDependencies, { '@remix-run/headers': '^1.0.0' })
  })

  it('applies publish metadata and removes packing hooks after artifacts are prepared', () => {
    let manifest = {
      name: 'remix',
      exports: { '.': './src/index.ts' },
      bin: { remix: './src/cli-entry.ts' },
      scripts: { prepack: 'generate', postpack: 'clean', test: 'remix test' },
      publishConfig: {
        exports: { '.': './dist/index.js' },
        bin: { remix: './dist/cli-entry.js' },
      },
    }
    let pkg = preparePreviewPackage(manifest, new Map())
    assert.deepEqual(pkg.exports, { '.': './dist/index.js' })
    assert.deepEqual(pkg.bin, { remix: './dist/cli-entry.js' })
    assert.deepEqual(pkg.scripts, { test: 'remix test' })
    assert.equal(pkg.publishConfig, undefined)
    assert.equal(manifest.scripts.prepack, 'generate')
  })

  it('rejects internal dependencies without an available preview tarball', () => {
    assert.throws(
      () =>
        preparePreviewPackage(
          { name: 'remix', dependencies: { '@remix-run/missing': 'workspace:^' } },
          new Map(),
        ),
      /Missing preview tarball for @remix-run\/missing in remix/,
    )
  })
})
