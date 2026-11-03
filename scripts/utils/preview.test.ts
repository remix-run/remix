import assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import {
  PREVIEW_RELEASE_MARKER,
  getExpiredPreviewReleases,
  getPreviewTag,
  getPreviewTarballUrl,
  preparePreviewPackage,
  readPreviewManifest,
} from './preview.ts'
import type { PreviewRelease } from './preview.ts'

describe('preview packages', () => {
  it('uses the full source SHA and destination release in tarball URLs', () => {
    let sha = '0123456789abcdef0123456789abcdef01234567'
    let tag = getPreviewTag('pr-123', sha)
    assert.equal(
      getPreviewTarballUrl(tag, 'remix', 'remix-run/custom-previews'),
      `https://github.com/remix-run/custom-previews/releases/download/pr-123-${sha}/remix.tgz`,
    )
    assert.notEqual(getPreviewTag('main', sha), getPreviewTag('pr-123', sha))
    assert.throws(() => getPreviewTag('../main', sha), /Invalid preview channel/)
    assert.throws(() => getPreviewTag('main', 'abc123'), /Invalid source SHA/)
    assert.throws(() => getPreviewTarballUrl(tag, '../remix'), /Invalid package directory/)
  })

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

const now = Date.parse('2026-11-02T12:00:00Z')

describe('preview release retention', () => {
  it('expires main builds older than seven days, keeping the exact cutoff', () => {
    let expired = release(1, 'main', '2026-10-26T11:59:59Z')
    let cutoff = release(2, 'main', '2026-10-26T12:00:00Z')
    let latest = release(3, 'main', '2026-11-02T00:00:00Z')
    assert.deepEqual(getExpiredPreviewReleases([latest, expired, cutoff], 'main', now), [expired])
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

  it('removes abandoned main drafts after seven days', () => {
    let draft = { ...release(1, 'main', '2020-01-01T00:00:00Z'), draft: true, published_at: null }
    assert.deepEqual(getExpiredPreviewReleases([draft], 'main', now), [draft])
  })

  it('selects every SHA and draft for a merged PR, without an age or count cap', () => {
    let builds = Array.from({ length: 120 }, (_, index) =>
      release(index + 1, 'pr-123', '2020-01-01T00:00:00Z'),
    )
    builds[0] = { ...builds[0], draft: true, published_at: null }
    assert.deepEqual(getExpiredPreviewReleases(builds, 'pr-123', now), builds)
  })

  it('does not mix PR numbers or delete experimental and unrelated releases', () => {
    let build = release(1, 'pr-12', '2020-01-01T00:00:00Z')
    let other = release(2, 'pr-123', '2020-01-01T00:00:00Z')
    let experimental = release(3, 'experimental-test', '2020-01-01T00:00:00Z')
    let unrelated = { ...release(4, 'pr-12', '2020-01-01T00:00:00Z'), body: 'Unrelated release' }
    let malformed = { ...release(5, 'pr-12', '2020-01-01T00:00:00Z'), tag_name: 'pr-12-short' }
    assert.deepEqual(
      getExpiredPreviewReleases([build, other, experimental, unrelated, malformed], 'pr-12', now),
      [build],
    )
    assert.deepEqual(getExpiredPreviewReleases([experimental], 'experimental-test', now), [])
    assert.deepEqual(getExpiredPreviewReleases([build, other, experimental], 'main', now), [])
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
