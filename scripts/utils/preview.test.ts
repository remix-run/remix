import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { gt, valid } from 'semver'

import {
  PREVIEW_RELEASE_MARKER,
  PreviewGitHub,
  cleanupPrPreviewBranch,
  getExpiredPreviewReleases,
  getExpiredPrPreviewAssets,
  getPreviewChannel,
  getPreviewReleaseTitle,
  getPreviewTag,
  getPreviewTarballUrl,
  parsePreviewBuild,
  preparePreviewPackage,
  publishPreview,
  readPullRequest,
} from './preview.ts'
import type { PreviewAsset, PreviewRelease } from './preview.ts'

describe('preview packages', () => {
  it('uses the UTC date as SemVer, with a fixed tag per PR', () => {
    let sha = 'abcdef1234567890'.padEnd(40, '0')
    let committedAt = '2026-11-02T23:30:00-05:00'
    let tag = getPreviewTag('main', sha, committedAt)
    assert.equal(tag, 'v0.20261103.0-main-abcdef12')
    assert.ok(valid(tag))
    let pr = getPreviewTag('pr-123', sha, committedAt)
    assert.equal(pr, 'v0.20261103.0-pr-123')
    assert.ok(valid(pr))
    assert.equal(getPreviewChannel(pr), 'pr-123')
    assert.equal(getPreviewTag('pr-123', 'b'.repeat(40), committedAt), pr)
    assert.equal(getPreviewTag('pr-123', sha, '2026-11-03T12:00:00Z'), pr)
    assert.equal(getPreviewChannel('pr-123'), 'pr-123')
    let experimental = getPreviewTag('experimental', sha, committedAt)
    assert.equal(experimental, 'v0.20261103.0-experimental-abcdef12')
    assert.ok(valid(experimental))
    assert.equal(getPreviewTag('experimental', sha, '2026-11-03T12:00:00Z'), experimental)
    assert.equal(getPreviewChannel(tag), 'main')
    assert.equal(getPreviewChannel('pr-123-20261103-abcdef12'), 'pr-123')
    assert.equal(getPreviewChannel(experimental), 'experimental')
    assert.equal(getPreviewTag('main', sha, '2026-11-03T00:00:00Z'), 'v0.20261103.0-main-abcdef12')
    assert.ok(
      gt(
        getPreviewTag('main', sha, '2027-01-01T00:00:00Z'),
        getPreviewTag('main', sha, '2026-12-31T23:59:59Z'),
      ),
    )
    assert.equal(getPreviewTag('main', sha, '2026-11-03T17:53:10Z'), tag)
    assert.notEqual(getPreviewTag('main', 'b'.repeat(40), '2026-11-03T17:53:10Z'), tag)
  })

  it('uses full SHA filenames within the shared PR release', () => {
    let sha = 'a'.repeat(40)
    let other = sha.slice(0, 8) + 'b'.repeat(32)
    let tag = getPreviewTag('pr-123', sha, '2026-11-02T12:00:00Z')
    let build = parsePreviewBuild(tag, sha)
    assert.equal(build.channel, 'pr-123')
    assert.equal(
      getPreviewTarballUrl(build, 'remix'),
      `https://github.com/remix-run/previews/releases/download/${tag}/remix-${sha}.tgz`,
    )
    assert.notEqual(
      getPreviewTarballUrl(build, 'remix'),
      getPreviewTarballUrl({ ...build, sha: other }, 'remix'),
    )
    assert.deepEqual(parsePreviewBuild(tag, 'b'.repeat(40)), {
      channel: 'pr-123',
      sha: 'b'.repeat(40),
      tag,
    })
  })

  it('uses concise display titles for each preview channel', () => {
    let sha = 'abcdef1234567890'.padEnd(40, '0')
    let pr = parsePreviewBuild('v0.20261026.417-pr-12082', sha)
    assert.equal(getPreviewReleaseTitle(pr), 'PR #12082')
    assert.equal(getPreviewReleaseTitle({ ...pr, sha: 'b'.repeat(40) }), getPreviewReleaseTitle(pr))
    assert.equal(
      getPreviewReleaseTitle(parsePreviewBuild('v0.20261103.195415-main-abcdef12', sha)),
      'main (abcdef12)',
    )
    assert.equal(
      getPreviewReleaseTitle(parsePreviewBuild('v0.20261103.0-experimental-abcdef12', sha)),
      'experimental (abcdef12)',
    )
    assert.equal(getPreviewReleaseTitle(parsePreviewBuild('pr-12082', sha)), 'PR #12082')
  })

  it('uses the planned version only for release PRs with a versioned title', () => {
    let build = parsePreviewBuild('v0.20261026.417-pr-12082', 'a'.repeat(40))
    assert.equal(
      getPreviewReleaseTitle(build, { headRef: 'release-pr/main', title: 'Release v3.2.0' }),
      'Remix 3.2.0 preview',
    )
    assert.equal(
      getPreviewReleaseTitle(build, {
        headRef: 'release-pr/main',
        title: 'Release v3.3.0-alpha.1',
      }),
      'Remix 3.3.0-alpha.1 preview',
    )
    assert.equal(
      getPreviewReleaseTitle(build, { headRef: 'other-branch', title: 'Release v3.2.0' }),
      'PR #12082',
    )
    assert.equal(
      getPreviewReleaseTitle(build, { headRef: 'release-pr/main', title: 'Release' }),
      'PR #12082',
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
    assert.throws(
      () => getPreviewTag('nightly', sha, '2026-11-02T12:00:00Z'),
      /Invalid preview channel/,
    )
    assert.throws(
      () => parsePreviewBuild('v0.20261102.0-nightly', sha),
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
    let createdAt = '2026-11-01T04:30:00Z'
    let headRef = 'feature'
    let title = 'Add a feature'
    let response = { title, head: { sha, ref: headRef }, created_at: createdAt }
    assert.deepEqual(
      readPullRequest('remix-run/remix', 123, () =>
        JSON.stringify({ ...response, state: 'closed', merged: false }),
      ),
      { closed: true, sha, headRef, title, createdAt },
    )
    assert.deepEqual(
      readPullRequest('remix-run/remix', 123, () =>
        JSON.stringify({ ...response, state: 'closed', merged: true }),
      ),
      { closed: true, sha, headRef, title, createdAt },
    )
    assert.deepEqual(
      readPullRequest('remix-run/remix', 123, () =>
        JSON.stringify({ ...response, state: 'open', merged: false }),
      ),
      { closed: false, sha, headRef, title, createdAt },
    )
  })

  it('expires main builds older than thirty days, keeping the exact cutoff', () => {
    let expired = release(1, 'main', '2026-10-03T11:59:59Z')
    let cutoff = release(2, 'main', '2026-10-03T12:00:00Z')
    let recent = release(5, 'main', '2026-10-25T12:00:00Z')
    let latest = release(3, 'main', '2026-11-02T00:00:00Z')
    let draft = { ...release(4, 'main', '2020-01-01T00:00:00Z'), draft: true, published_at: null }
    assert.deepEqual(
      getExpiredPreviewReleases([latest, expired, cutoff, recent, draft], 'main', now),
      [expired, draft],
    )
  })

  it('always keeps the most recently published main build, even if every build is old', () => {
    let older = release(1, 'main', '2020-02-02T13:00:00Z')
    let latest = release(2, 'main', '2020-02-01T12:00:00Z')
    latest.published_at = '2020-02-03T12:00:00Z'
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
    let expired = release(1, 'experimental', '2026-10-03T11:59:59Z')
    let cutoff = release(2, 'experimental', '2026-10-03T12:00:00Z')
    let other = {
      ...release(3, 'experimental', '2020-01-01T00:00:00Z'),
      tag_name: 'experimental-beta-20200101-00000003',
    }
    let recent = {
      ...release(4, 'experimental', '2020-01-01T00:00:00Z'),
      published_at: '2026-11-02T00:00:00Z',
    }
    let draft = {
      ...release(5, 'experimental', '2020-01-01T00:00:00Z'),
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
    let experimental = release(3, 'experimental', '2020-01-01T00:00:00Z')
    let unrelated = { ...release(4, 'pr-12', '2020-01-01T00:00:00Z'), body: 'Unrelated release' }
    let malformed = { ...release(5, 'pr-12', '2020-01-01T00:00:00Z'), tag_name: 'pr-12-short' }
    let legacyShared = { ...build, id: 7, tag_name: 'pr-12' }
    let legacySha = { ...build, id: 8, tag_name: 'pr-12-20200101-00000001' }
    assert.deepEqual(
      getExpiredPreviewReleases(
        [build, draft, other, experimental, unrelated, malformed, legacyShared, legacySha],
        'pr-12',
        now,
      ),
      [build, draft, legacyShared, legacySha],
    )
    assert.deepEqual(getExpiredPreviewReleases([build, other, experimental], 'main', now), [])
  })
})

describe('main publication', () => {
  it('marks new main publications latest regardless of source order, without promoting reruns', (t) => {
    let directory = fs.mkdtempSync(path.join(os.tmpdir(), 'remix-main-test-'))
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
    fs.writeFileSync(path.join(directory, 'remix.tgz'), 'remix')
    let legacy = release(1, 'main', '2026-11-02T12:00:00Z')
    legacy.tag_name = 'v0.20261102.120000-main-00000001'
    let releases = [legacy]
    let assets = new Map<number, PreviewAsset[]>()
    let publications: boolean[] = []
    let sourceTime = '2026-11-02T11:00:00Z'
    let github = new PreviewGitHub('remix-run/previews', () => {
      throw new Error('Unexpected GitHub command')
    })
    t.mock.method(
      github,
      'api',
      (method: string, endpoint: string, body?: Record<string, unknown>) => {
        if (method === 'GET' && endpoint.startsWith('releases?')) return releases
        if (method === 'POST' && endpoint === 'releases') {
          if (typeof body?.tag_name !== 'string' || typeof body.body !== 'string')
            throw new Error('Missing release metadata')
          let draft = {
            ...release(releases.length + 1, 'main', sourceTime),
            tag_name: body.tag_name,
            body: body.body,
            draft: true,
          }
          releases.push(draft)
          return draft
        }
        let id = Number(/^releases\/(\d+)/.exec(endpoint)?.[1])
        if (method === 'GET' && endpoint.startsWith(`releases/${id}/assets?`))
          return assets.get(id) ?? []
        if (method === 'PATCH' && endpoint === `releases/${id}`) {
          let published = releases.find((item) => item.id === id)
          if (!published) throw new Error('Missing release')
          if (body?.draft === false) {
            published.draft = false
          }
          if (body?.make_latest !== undefined) publications.push(body.make_latest === 'true')
          return null
        }
        throw new Error(`Unexpected GitHub API call: ${method} ${endpoint}`)
      },
    )
    t.mock.method(github, 'upload', (draft: PreviewRelease, filename: string) => {
      let uploaded = assets.get(draft.id) ?? []
      uploaded.push({
        ...previewAsset(uploaded.length + 1, path.basename(filename), now),
        size: fs.readFileSync(filename).length,
      })
      assets.set(draft.id, uploaded)
    })
    let sha = 'a'.repeat(40)
    publishPreview(
      github,
      parsePreviewBuild(getPreviewTag('main', sha, sourceTime), sha),
      directory,
    )
    sourceTime = '2026-11-02T14:00:00Z'
    sha = 'b'.repeat(40)
    publishPreview(
      github,
      parsePreviewBuild(getPreviewTag('main', sha, sourceTime), sha),
      directory,
    )
    sourceTime = '2026-11-02T13:00:00Z'
    sha = 'c'.repeat(40)
    publishPreview(
      github,
      parsePreviewBuild(getPreviewTag('main', sha, sourceTime), sha),
      directory,
    )
    sha = 'a'.repeat(40)
    publishPreview(
      github,
      parsePreviewBuild(getPreviewTag('main', sha, sourceTime), sha),
      directory,
    )
    assert.deepEqual(publications, [true, true, true])
  })
})

describe('preview ref cleanup', () => {
  it('deletes only the matching legacy PR branch', () => {
    let calls: string[][] = []
    let github = new PreviewGitHub('remix-run/remix', (args) => {
      calls.push(args)
      return ''
    })
    cleanupPrPreviewBranch(github, 'pr-123')
    assert.deepEqual(calls, [
      ['api', '--method', 'DELETE', 'repos/remix-run/remix/git/refs/heads/preview/pr-123'],
    ])
    assert.throws(
      () => cleanupPrPreviewBranch(github, '../../main'),
      /Invalid legacy PR preview channel/,
    )
    assert.throws(() => cleanupPrPreviewBranch(github, 'main'), /Invalid legacy PR preview channel/)
    cleanupPrPreviewBranch(github, 'pr-123', { dryRun: true })
    assert.equal(calls.length, 1)
  })

  it('ignores missing refs without swallowing permission or validation errors', () => {
    let stderr = 'gh: Reference does not exist (HTTP 422)'
    let github = new PreviewGitHub('remix-run/previews', () => {
      throw Object.assign(new Error('request failed'), { stderr })
    })
    let tag = 'git/refs/tags/preview'
    github.delete(tag)
    let branch = 'git/refs/heads/preview/pr-123'
    github.delete(branch)
    stderr = 'gh: Not Found (HTTP 404)'
    github.delete(tag)
    stderr = 'gh: Forbidden (HTTP 403)'
    assert.throws(() => github.delete(tag), /request failed/)
    assert.throws(() => github.delete(branch), /request failed/)
    stderr = 'gh: Validation Failed (HTTP 422)'
    assert.throws(() => github.delete(tag), /request failed/)
    assert.throws(() => github.delete(branch), /request failed/)
  })
})

describe('shared PR preview releases', () => {
  it('retains five complete SHA groups by completion time and removes incomplete uploads', () => {
    let builds = Array.from({ length: 7 }, (_, index) => {
      let sha = index.toString(16).padStart(8, '0').padEnd(40, '0')
      let updated_at = new Date(now + index * 1000).toISOString()
      return [
        {
          id: index * 2,
          name: `remix-${sha}.tgz`,
          label: `Complete preview build: ${sha}`,
          updated_at,
          state: 'uploaded',
          size: 1,
          digest: null,
        },
        {
          id: index * 2 + 1,
          name: `assert-${sha}.tgz`,
          label: null,
          updated_at,
          state: 'uploaded',
          size: 1,
          digest: null,
        },
      ]
    })
    let incomplete = { ...builds[0][1], id: 30, name: `assert-${'f'.repeat(40)}.tgz` }
    let unrelated = { ...incomplete, id: 31, name: 'notes.txt' }
    assert.deepEqual(
      getExpiredPrPreviewAssets([...builds.flat().reverse(), incomplete, unrelated])
        .map((asset) => asset.id)
        .toSorted((a, b) => a - b),
      [0, 1, 2, 3, 30],
    )
  })

  it('retains legacy short SHA builds until they leave the retention window', () => {
    let legacySha = 'a'.repeat(40)
    let fullSha = legacySha.slice(0, 8) + 'b'.repeat(32)
    let assets = [
      previewAsset(
        1,
        `remix-${legacySha.slice(0, 8)}.tgz`,
        now,
        `Complete preview build: ${legacySha}`,
      ),
      previewAsset(2, `assert-${legacySha.slice(0, 8)}.tgz`, now),
      previewAsset(3, `remix-${fullSha}.tgz`, now + 1000, `Complete preview build: ${fullSha}`),
      previewAsset(4, `assert-${fullSha}.tgz`, now + 1000),
    ]
    assert.deepEqual(getExpiredPrPreviewAssets(assets), [])

    let newer = Array.from({ length: 4 }, (_, index) => {
      let sha = index.toString(16).padStart(40, '0')
      let updatedAt = now + (index + 2) * 1000
      return [
        previewAsset(
          10 + index * 2,
          `remix-${sha}.tgz`,
          updatedAt,
          `Complete preview build: ${sha}`,
        ),
        previewAsset(11 + index * 2, `assert-${sha}.tgz`, updatedAt),
      ]
    })
    assert.deepEqual(
      getExpiredPrPreviewAssets([...assets, ...newer.flat()]).map((asset) => asset.id),
      [1, 2],
    )
  })

  it('expires a legacy build after its full SHA replacement completes', () => {
    let sha = 'a'.repeat(40)
    let assets = [
      previewAsset(1, `remix-${sha.slice(0, 8)}.tgz`, now, `Complete preview build: ${sha}`),
      previewAsset(2, `assert-${sha.slice(0, 8)}.tgz`, now),
      previewAsset(3, `remix-${sha}.tgz`, now + 1000, `Complete preview build: ${sha}`),
      previewAsset(4, `assert-${sha}.tgz`, now + 1000),
    ]
    assert.deepEqual(
      getExpiredPrPreviewAssets(assets).map((asset) => asset.id),
      [1, 2],
    )
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

function previewAsset(
  id: number,
  name: string,
  updatedAt: number,
  label: string | null = null,
): PreviewAsset {
  return {
    id,
    name,
    label,
    updated_at: new Date(updatedAt).toISOString(),
    state: 'uploaded',
    size: 1,
    digest: null,
  }
}
