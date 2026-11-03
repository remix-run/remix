import assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import {
  PREVIEW_RELEASE_MARKER,
  PreviewGitHub,
  getExpiredPreviewReleases,
  getPreviewChannel,
  getPreviewTag,
  getPreviewTarballUrl,
  parsePreviewBuild,
  preparePreviewPackage,
  readPullRequest,
} from './preview.ts'
import type { PreviewRelease } from './preview.ts'

describe('preview packages', () => {
  it('uses the UTC commit date and eight SHA characters while preserving channel prefixes', () => {
    let sha = 'abcdef1234567890'.padEnd(40, '0')
    let committedAt = '2026-11-02T23:30:00-05:00'
    let tag = getPreviewTag('main', sha, committedAt)
    assert.equal(tag, 'main-20261103-abcdef12')
    assert.equal(getPreviewTag('pr-123', sha, committedAt), 'pr-123-20261103-abcdef12')
    let experimental = getPreviewTag('experimental-feature-123', sha, committedAt)
    assert.equal(experimental, 'experimental-feature-123-20261103-abcdef12')
    assert.equal(getPreviewChannel(tag), 'main')
    assert.equal(getPreviewChannel('pr-123-20261103-abcdef12'), 'pr-123')
    assert.equal(getPreviewChannel(experimental), 'experimental-feature-123')
  })

  it('requires a valid tag matching the full source SHA', () => {
    let sha = 'a'.repeat(40)
    let tag = getPreviewTag('main', sha, '2026-11-02T12:00:00Z')
    assert.deepEqual(parsePreviewBuild(tag, sha), { channel: 'main', sha, tag })
    assert.throws(() => parsePreviewBuild('different', sha), /Invalid preview tag or source SHA/)
    assert.throws(() => parsePreviewBuild(tag, 'b'.repeat(40)), /Invalid preview tag or source SHA/)
    assert.throws(
      () => parsePreviewBuild(tag, sha.slice(0, 8)),
      /Invalid preview tag or source SHA/,
    )
  })

  it('rewrites internal runtime dependencies while preserving external and peer ranges', () => {
    let url = getPreviewTarballUrl(
      getPreviewTag('main', 'a'.repeat(40), '2026-11-02T12:00:00Z'),
      'headers',
    )
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
  it('treats both merged and unmerged closed PRs as closed, keeping open PRs', () => {
    let sha = 'a'.repeat(40)
    assert.deepEqual(
      readPullRequest('remix-run/remix', 123, () =>
        JSON.stringify({ state: 'closed', merged: false, head: { sha } }),
      ),
      { closed: true, sha },
    )
    assert.deepEqual(
      readPullRequest('remix-run/remix', 123, () =>
        JSON.stringify({ state: 'closed', merged: true, head: { sha } }),
      ),
      { closed: true, sha },
    )
    assert.deepEqual(
      readPullRequest('remix-run/remix', 123, () =>
        JSON.stringify({ state: 'open', merged: false, head: { sha } }),
      ),
      { closed: false, sha },
    )
  })

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
    tag_name: getPreviewTag(channel, id.toString(16).padStart(8, '0').padEnd(40, '0'), timestamp),
    body: PREVIEW_RELEASE_MARKER,
    draft: false,
    created_at: timestamp,
    published_at: timestamp,
  }
}
