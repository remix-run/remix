import assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import {
  PREVIEW_RELEASE_MARKER,
  PreviewGitHub,
  getExpiredPreviewReleases,
  getPreviewTag,
  getPreviewTarballUrl,
  preparePreviewPackage,
  readPreviewManifest,
} from './preview.ts'
import type { PreviewRelease } from './preview.ts'

describe('preview packages', () => {
  it('validates the manifest and rejects assets outside its destination release', () => {
    let tag = getPreviewTag('main', 'a'.repeat(40))
    let manifest = {
      repository: 'remix-run/previews',
      sourceRepository: 'remix-run/remix',
      channel: 'main',
      sha: 'a'.repeat(40),
      tag,
      createdAt: '2026-11-02T12:00:00Z',
      packages: { remix: getPreviewTarballUrl(tag, 'remix') },
    }
    assert.deepEqual(readPreviewManifest(JSON.stringify(manifest)), manifest)
    assert.throws(
      () =>
        readPreviewManifest(
          JSON.stringify({ ...manifest, packages: { remix: 'https://example.com/remix.tgz' } }),
        ),
      /Invalid or duplicate preview URL/,
    )
    assert.throws(
      () =>
        readPreviewManifest(
          JSON.stringify({
            ...manifest,
            packages: { ...manifest.packages, duplicate: manifest.packages.remix },
          }),
        ),
      /Invalid or duplicate preview URL/,
    )
    assert.throws(
      () => readPreviewManifest(JSON.stringify({ ...manifest, tag: 'different' })),
      /Invalid preview manifest/,
    )
  })

  it('rewrites internal runtime dependencies while preserving external and peer ranges', () => {
    let url = getPreviewTarballUrl(getPreviewTag('main', 'a'.repeat(40)), 'headers')
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
})

const now = Date.parse('2026-11-02T12:00:00Z')

describe('preview release retention', () => {
  it('expires main builds older than seven days, keeping the exact cutoff', () => {
    let expired = release(1, 'main', '2026-10-26T11:59:59Z')
    let cutoff = release(2, 'main', '2026-10-26T12:00:00Z')
    let latest = release(3, 'main', '2026-11-02T00:00:00Z')
    let draft = { ...release(4, 'main', '2020-01-01T00:00:00Z'), draft: true, published_at: null }
    assert.deepEqual(getExpiredPreviewReleases([latest, expired, cutoff, draft], 'main', now), [
      expired,
      draft,
    ])
  })

  it('always keeps the newest successful main build, even if every build is old', () => {
    let older = release(1, 'main', '2020-01-01T00:00:00Z')
    let latest = release(2, 'main', '2020-02-01T00:00:00Z')
    let draft = { ...release(3, 'main', '2026-11-02T00:00:00Z'), draft: true, published_at: null }
    assert.deepEqual(getExpiredPreviewReleases([older, draft, latest], 'main', now), [older])
  })

  it('uses original publication time instead of release creation or rerun time', () => {
    let build = {
      ...release(1, 'main', '2020-01-01T00:00:00Z'),
      published_at: '2026-11-02T00:00:00Z',
    }
    let expired = release(2, 'main', '2020-01-01T00:00:00Z')
    assert.deepEqual(getExpiredPreviewReleases([expired, build], 'main', now), [expired])
  })

  it('does not mix PR numbers or delete experimental and unrelated releases', () => {
    let build = release(1, 'pr-12', '2020-01-01T00:00:00Z')
    let draft = { ...release(6, 'pr-12', '2020-01-01T00:00:00Z'), draft: true, published_at: null }
    let other = release(2, 'pr-123', '2020-01-01T00:00:00Z')
    let experimental = release(3, 'experimental-test', '2020-01-01T00:00:00Z')
    let unrelated = { ...release(4, 'pr-12', '2020-01-01T00:00:00Z'), body: 'Unrelated release' }
    let malformed = { ...release(5, 'pr-12', '2020-01-01T00:00:00Z'), tag_name: 'pr-12-short' }
    assert.deepEqual(
      getExpiredPreviewReleases(
        [build, draft, other, experimental, unrelated, malformed],
        'pr-12',
        now,
      ),
      [build, draft],
    )
    assert.deepEqual(getExpiredPreviewReleases([experimental], 'experimental-test', now), [])
    assert.deepEqual(getExpiredPreviewReleases([build, other, experimental], 'main', now), [])
  })
})

describe('preview tag cleanup', () => {
  it('ignores missing tags without swallowing permission or validation errors', () => {
    let stderr = 'gh: Reference does not exist (HTTP 422)'
    let github = new PreviewGitHub('remix-run/previews', () => {
      throw Object.assign(new Error('request failed'), { stderr })
    })
    let tag = 'git/refs/tags/preview'
    github.delete(tag)
    stderr = 'gh: Not Found (HTTP 404)'
    github.delete(tag)
    stderr = 'gh: Forbidden (HTTP 403)'
    assert.throws(() => github.delete(tag), /request failed/)
    stderr = 'gh: Validation Failed (HTTP 422)'
    assert.throws(() => github.delete(tag), /request failed/)
  })
})

function release(id: number, channel: string, timestamp: string): PreviewRelease {
  return {
    id,
    tag_name: `${channel}-${id.toString(16).padStart(40, '0')}`,
    body: PREVIEW_RELEASE_MARKER,
    draft: false,
    created_at: timestamp,
    published_at: timestamp,
  }
}
