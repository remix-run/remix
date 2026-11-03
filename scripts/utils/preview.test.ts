import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

import assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import {
  PREVIEW_RELEASE_MARKER,
  PreviewGitHub,
  getExpiredPreviewReleases,
  getExpiredPrPreviewAssets,
  getPreviewChannel,
  getPreviewTag,
  getPreviewTarballUrl,
  parsePreviewBuild,
  preparePreviewPackage,
  publishPreview,
  readPullRequest,
} from './preview.ts'
import type { PreviewAsset, PreviewBuild, PreviewRelease } from './preview.ts'

describe('preview packages', () => {
  it('uses dated tags for main and experiments, and one tag per PR', () => {
    let sha = 'abcdef1234567890'.padEnd(40, '0')
    let committedAt = '2026-11-02T23:30:00-05:00'
    let tag = getPreviewTag('main', sha, committedAt)
    assert.equal(tag, 'main-20261103-abcdef12')
    assert.equal(getPreviewTag('pr-123', sha, committedAt), 'pr-123')
    assert.equal(getPreviewChannel('pr-123'), 'pr-123')
    let experimental = getPreviewTag('experimental-feature-123', sha, committedAt)
    assert.equal(experimental, 'experimental-feature-123-20261103-abcdef12')
    assert.equal(getPreviewChannel(tag), 'main')
    assert.equal(getPreviewChannel('pr-123-20261103-abcdef12'), 'pr-123')
    assert.equal(getPreviewChannel(experimental), 'experimental-feature-123')
  })

  it('uses eight-character SHA filenames within the shared PR release', () => {
    let sha = 'a'.repeat(40)
    let other = sha.slice(0, 8) + 'b'.repeat(32)
    let build = parsePreviewBuild('pr-123', sha)
    assert.equal(
      getPreviewTarballUrl(build, 'remix'),
      `https://github.com/remix-run/previews/releases/download/pr-123/remix-${sha.slice(0, 8)}.tgz`,
    )
    assert.equal(
      getPreviewTarballUrl(build, 'remix'),
      getPreviewTarballUrl({ ...build, sha: other }, 'remix'),
    )
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
      parsePreviewBuild(
        getPreviewTag('main', 'a'.repeat(40), '2026-11-02T12:00:00Z'),
        'a'.repeat(40),
      ),
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

  it('expires experimental builds after thirty days without keeping the newest in each channel', () => {
    let expired = release(1, 'experimental-alpha', '2026-10-03T11:59:59Z')
    let cutoff = release(2, 'experimental-alpha', '2026-10-03T12:00:00Z')
    let other = release(3, 'experimental-beta', '2020-01-01T00:00:00Z')
    let recent = {
      ...release(4, 'experimental-gamma', '2020-01-01T00:00:00Z'),
      published_at: '2026-11-02T00:00:00Z',
    }
    let draft = {
      ...release(5, 'experimental-draft', '2020-01-01T00:00:00Z'),
      draft: true,
      published_at: null,
    }
    let main = release(6, 'main', '2020-01-01T00:00:00Z')
    let pr = release(7, 'pr-123', '2020-01-01T00:00:00Z')
    let unrelated = { ...expired, id: 8, body: 'Unrelated release' }
    assert.deepEqual(
      getExpiredPreviewReleases(
        [expired, cutoff, other, recent, draft, main, pr, unrelated],
        'experimental',
        now,
      ),
      [expired, other, draft],
    )
  })

  it('keeps PR cleanup scoped to its PR and ignores unrelated releases', () => {
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

describe('shared PR preview releases', () => {
  it('retains ten complete SHA groups by completion time and removes incomplete uploads', () => {
    let builds = Array.from({ length: 12 }, (_, index) => {
      let sha = index.toString(16).padStart(8, '0').padEnd(40, '0')
      let updated_at = new Date(now + index * 1000).toISOString()
      return [
        {
          id: index * 2,
          name: `remix-${sha.slice(0, 8)}.tgz`,
          label: `Complete preview build: ${sha}`,
          updated_at,
          state: 'uploaded',
          size: 1,
          digest: null,
        },
        {
          id: index * 2 + 1,
          name: `assert-${sha.slice(0, 8)}.tgz`,
          label: null,
          updated_at,
          state: 'uploaded',
          size: 1,
          digest: null,
        },
      ]
    })
    let incomplete = { ...builds[0][1], id: 30, name: `assert-${'f'.repeat(8)}.tgz` }
    let unrelated = { ...incomplete, id: 31, name: 'notes.txt' }
    assert.deepEqual(
      getExpiredPrPreviewAssets([...builds.flat().reverse(), incomplete, unrelated])
        .map((asset) => asset.id)
        .toSorted((a, b) => a - b),
      [0, 1, 2, 3, 30],
    )
  })

  it('retries partial uploads without replacing completed SHA builds or changing their age', () => {
    let fixture = prPublisher()
    try {
      let first = fixture.build('a'.repeat(40))
      publishPreview(fixture.github, first.build, first.directory)
      let original = fixture.assets.map((asset) => ({ ...asset }))
      let second = fixture.build('b'.repeat(40))
      fixture.failOnUpload = fixture.uploads + 2
      assert.throws(
        () => publishPreview(fixture.github, second.build, second.directory),
        /interrupted/,
      )
      assert.equal(fixture.release?.draft, false)
      assert.equal(fixture.assets.filter((asset) => asset.label !== null).length, 1)
      fixture.failOnUpload = undefined
      publishPreview(fixture.github, second.build, second.directory)
      assert.equal(fixture.assets.length, 4)
      assert.deepEqual(
        fixture.assets.filter((asset) =>
          asset.name.endsWith(`-${first.build.sha.slice(0, 8)}.tgz`),
        ),
        original,
      )
      let uploads = fixture.uploads
      writeFileSync(
        join(first.directory, `remix-${first.build.sha.slice(0, 8)}.tgz`),
        'different rebuild bytes',
      )
      publishPreview(fixture.github, first.build, first.directory)
      assert.equal(fixture.uploads, uploads)
      assert.deepEqual(
        fixture.assets.filter((asset) =>
          asset.name.endsWith(`-${first.build.sha.slice(0, 8)}.tgz`),
        ),
        original,
      )
      assert.ok(fixture.release?.body.includes(`/commits/${second.build.sha}`))
      let collision = fixture.build('a'.repeat(8) + 'c'.repeat(32))
      assert.throws(
        () => publishPreview(fixture.github, collision.build, collision.directory),
        /SHA collision/,
      )
      assert.equal(fixture.uploads, uploads)
      for (let index = 0; index < 10; index++) {
        let next = fixture.build(index.toString(16).padStart(8, '0').padEnd(40, '0'))
        publishPreview(fixture.github, next.build, next.directory)
      }
      assert.equal(fixture.assets.length, 20)
      assert.ok(!fixture.release?.body.includes(`/commits/${first.build.sha}`))
      assert.ok(!fixture.release?.body.includes(`/commits/${second.build.sha}`))
    } finally {
      fixture.dispose()
    }
  })
})

function prPublisher() {
  let root = mkdtempSync(join(tmpdir(), 'pr-preview-'))
  let github = new PreviewGitHub('remix-run/previews', () => {
    throw new Error('Unexpected GitHub command')
  })
  let fixture: {
    github: PreviewGitHub
    release: PreviewRelease | undefined
    assets: PreviewAsset[]
    uploads: number
    failOnUpload: number | undefined
    build(sha: string): { directory: string; build: PreviewBuild }
    dispose(): void
  } = {
    github,
    release: undefined,
    assets: [],
    uploads: 0,
    failOnUpload: undefined,
    build(sha: string) {
      let directory = join(root, sha)
      mkdirSync(directory)
      writeFileSync(join(directory, `remix-${sha.slice(0, 8)}.tgz`), 'remix bytes')
      writeFileSync(join(directory, `assert-${sha.slice(0, 8)}.tgz`), 'assert bytes')
      return { directory, build: parsePreviewBuild('pr-123', sha) }
    },
    dispose() {
      rmSync(root, { recursive: true, force: true })
    },
  }
  let nextId = 1
  github.listReleases = () => (fixture.release ? [fixture.release] : [])
  github.listAssets = () => fixture.assets.map((asset) => ({ ...asset }))
  github.upload = (_release, filename) => {
    fixture.uploads++
    if (fixture.uploads === fixture.failOnUpload) throw new Error('interrupted')
    let bytes = readFileSync(filename)
    fixture.assets.push({
      id: nextId++,
      name: basename(filename),
      size: bytes.length,
      state: 'uploaded',
      digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
      label: null,
      updated_at: new Date(now + nextId * 1000).toISOString(),
    })
  }
  github.delete = (endpoint) => {
    fixture.assets = fixture.assets.filter((asset) => endpoint !== `releases/assets/${asset.id}`)
  }
  github.api = (method, endpoint, body) => {
    if (method === 'POST' && endpoint === 'releases' && typeof body?.body === 'string') {
      fixture.release = {
        ...release(1, 'pr-123', new Date(now).toISOString()),
        draft: true,
        published_at: null,
        body: body.body,
      }
      return fixture.release
    }
    if (
      method === 'PATCH' &&
      endpoint.startsWith('releases/assets/') &&
      typeof body?.label === 'string'
    ) {
      let asset = fixture.assets.find((asset) => endpoint === `releases/assets/${asset.id}`)
      if (!asset) throw new Error('Missing asset')
      asset.label = body.label
      asset.updated_at = new Date(now + nextId++ * 1000).toISOString()
      return asset
    }
    if (
      method === 'PATCH' &&
      fixture.release &&
      endpoint === `releases/${fixture.release.id}` &&
      typeof body?.body === 'string'
    ) {
      fixture.release.body = body.body
      fixture.release.draft = false
      return fixture.release
    }
    throw new Error(`Unexpected API call: ${method} ${endpoint}`)
  }
  return fixture
}

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
