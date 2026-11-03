import assert from '@remix-run/assert'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { createHash } from 'node:crypto'
import { describe, it } from '@remix-run/test'

import {
  PreviewGitHub,
  cleanupPreviews,
  publishPreview,
  publishPreviewBuild,
  readPullRequest,
} from './preview-releases.ts'
import type { GitHubRunner, PreviewAsset } from './preview-releases.ts'
import { PREVIEW_RELEASE_MARKER, getPreviewTag, getPreviewTarballUrl } from './preview.ts'
import type { PreviewManifest, PreviewRelease } from './preview.ts'

const timestamp = '2026-11-02T00:00:00Z'

describe('preview release publishing', () => {
  it('uploads the full package set and manifest before publishing a prerelease', () => {
    let fixture = createFixture()
    try {
      publishPreview(fixture.github, fixture.manifest, fixture.directory)
      assert.equal(fixture.releases.length, 1)
      assert.equal(fixture.releases[0].draft, false)
      assert.deepEqual(fixture.assets.map((asset) => asset.name).sort(), [
        'headers.tgz',
        'preview.json',
        'remix.tgz',
      ])
      assert.equal(fixture.publishedWithCompleteAssets, true)
      assert.equal(fixture.createBody?.make_latest, 'false')
      assert.equal(fixture.createBody?.prerelease, true)
      assert.match(String(fixture.createBody?.body), /remix-run\/remix\/commit\//)
    } finally {
      fixture.dispose()
    }
  })

  it('reuses published bytes and timestamps even when a rebuild produces different bytes', () => {
    let fixture = createFixture()
    try {
      publishPreview(fixture.github, fixture.manifest, fixture.directory)
      let assets = structuredClone(fixture.assets)
      let release = structuredClone(fixture.releases[0])
      fixture.calls.length = 0
      fs.writeFileSync(path.join(fixture.directory, 'remix.tgz'), 'different build')
      publishPreview(fixture.github, fixture.manifest, fixture.directory)
      assert.deepEqual(fixture.assets, assets)
      assert.deepEqual(fixture.releases[0], release)
      assert.equal(
        fixture.calls.every((args) => args[0] === 'api' && args[2] === 'GET'),
        true,
      )
    } finally {
      fixture.dispose()
    }
  })

  it('recovers an interrupted draft and replaces its partial assets as a set', () => {
    let fixture = createFixture()
    try {
      fixture.failUpload = 'headers.tgz'
      assert.throws(
        () => publishPreview(fixture.github, fixture.manifest, fixture.directory),
        /upload failed/,
      )
      assert.equal(fixture.releases[0].draft, true)
      assert.equal(fixture.assets.length, 1)
      fixture.failUpload = ''
      publishPreview(fixture.github, fixture.manifest, fixture.directory)
      assert.equal(fixture.releases.length, 1)
      assert.equal(fixture.releases[0].draft, false)
      assert.equal(fixture.assets.length, 3)
    } finally {
      fixture.dispose()
    }
  })

  it('leaves a draft unpublished when uploaded bytes do not match', () => {
    let fixture = createFixture()
    try {
      fixture.corruptUpload = true
      assert.throws(
        () => publishPreview(fixture.github, fixture.manifest, fixture.directory),
        /incomplete or do not match/,
      )
      assert.equal(fixture.releases[0].draft, true)
    } finally {
      fixture.dispose()
    }
  })

  it('rejects incomplete published releases without modifying them', () => {
    let fixture = createFixture()
    try {
      fixture.releases.push(fixture.release(1, fixture.manifest.tag))
      assert.throws(
        () => publishPreview(fixture.github, fixture.manifest, fixture.directory),
        /incomplete/,
      )
      assert.equal(fixture.assets.length, 0)
      assert.equal(fixture.releases[0].draft, false)
    } finally {
      fixture.dispose()
    }
  })

  it('does not replace unrelated releases with colliding tags', () => {
    let fixture = createFixture()
    try {
      fixture.releases.push({
        ...fixture.release(1, fixture.manifest.tag),
        body: 'Someone else owns this',
      })
      assert.throws(
        () => publishPreview(fixture.github, fixture.manifest, fixture.directory),
        /unrelated release/,
      )
      assert.equal(fixture.assets.length, 0)
    } finally {
      fixture.dispose()
    }
  })

  it('validates local assets in dry-run mode without making GitHub calls', () => {
    let fixture = createFixture()
    try {
      publishPreview(fixture.github, fixture.manifest, fixture.directory, true)
      assert.equal(fixture.calls.length, 0)
      fs.rmSync(path.join(fixture.directory, 'headers.tgz'))
      assert.throws(
        () => publishPreview(fixture.github, fixture.manifest, fixture.directory, true),
        /ENOENT/,
      )
      assert.equal(fixture.calls.length, 0)
    } finally {
      fixture.dispose()
    }
  })

  it('keeps every previous SHA when publishing another build for an unmerged PR', () => {
    let fixture = createFixture()
    try {
      fixture.releases.push(fixture.release(99, getPreviewTag('pr-123', 'b'.repeat(40))))
      assert.equal(
        publishPreviewBuild(fixture.github, fixture.manifest, fixture.directory, {
          isMerged: () => false,
        }),
        true,
      )
      assert.equal(fixture.releases.length, 2)
      assert.equal(fixture.deletedTags.length, 0)
    } finally {
      fixture.dispose()
    }
  })

  it('cleans existing builds and skips uploading when publication starts after merge', () => {
    let fixture = createFixture()
    try {
      fixture.releases.push(fixture.release(99, getPreviewTag('pr-123', 'b'.repeat(40))))
      assert.equal(
        publishPreviewBuild(fixture.github, fixture.manifest, fixture.directory, {
          isMerged: () => true,
        }),
        false,
      )
      assert.equal(fixture.releases.length, 0)
      assert.equal(
        fixture.calls.some((args) => args[0] === 'release'),
        false,
      )
    } finally {
      fixture.dispose()
    }
  })

  it('removes the current and older builds when the PR merges during publication', () => {
    let fixture = createFixture()
    try {
      fixture.releases.push(fixture.release(99, getPreviewTag('pr-123', 'b'.repeat(40))))
      let checks = 0
      assert.equal(
        publishPreviewBuild(fixture.github, fixture.manifest, fixture.directory, {
          isMerged: () => ++checks > 1,
        }),
        false,
      )
      assert.equal(fixture.releases.length, 0)
      assert.equal(fixture.deletedTags.length, 2)
    } finally {
      fixture.dispose()
    }
  })

  it('cleans an interrupted draft if the PR merges while an upload fails', () => {
    let fixture = createFixture()
    try {
      fixture.failUpload = 'headers.tgz'
      let checks = 0
      assert.throws(
        () =>
          publishPreviewBuild(fixture.github, fixture.manifest, fixture.directory, {
            isMerged: () => ++checks > 1,
          }),
        /upload failed/,
      )
      assert.equal(fixture.releases.length, 0)
      assert.equal(fixture.deletedTags.length, 1)
    } finally {
      fixture.dispose()
    }
  })

  it('rejects a manifest for a different destination', () => {
    let fixture = createFixture()
    try {
      assert.throws(
        () =>
          publishPreview(
            fixture.github,
            { ...fixture.manifest, repository: 'other/repo' },
            fixture.directory,
          ),
        /repository mismatch/,
      )
      assert.equal(fixture.calls.length, 0)
    } finally {
      fixture.dispose()
    }
  })
})

describe('preview release cleanup', () => {
  it('paginates through every PR release and deletes their tags along with releases', () => {
    let fixture = createFixture()
    try {
      fixture.releases.push(
        ...Array.from({ length: 105 }, (_, index) =>
          fixture.release(index + 1, getPreviewTag('pr-123', index.toString(16).padStart(40, '0'))),
        ),
      )
      fixture.releases.push(fixture.release(999, getPreviewTag('pr-1234', 'f'.repeat(40))))
      cleanupPreviews(fixture.github, 'pr-123')
      assert.equal(fixture.releases.length, 1)
      assert.equal(fixture.releases[0].id, 999)
      assert.equal(fixture.deletedTags.length, 105)
      cleanupPreviews(fixture.github, 'pr-123')
      assert.equal(fixture.releases.length, 1)
    } finally {
      fixture.dispose()
    }
  })

  it('can retry deletion when a tag is already absent', () => {
    let fixture = createFixture()
    try {
      fixture.releases.push(fixture.release(1, fixture.manifest.tag))
      fixture.tagMissing = '404'
      cleanupPreviews(fixture.github, 'pr-123')
      assert.equal(fixture.releases.length, 0)
    } finally {
      fixture.dispose()
    }
  })

  it('can clean drafts whose tag was never created', () => {
    let fixture = createFixture()
    try {
      fixture.releases.push({
        ...fixture.release(1, fixture.manifest.tag),
        draft: true,
        published_at: null,
      })
      fixture.tagMissing = '422'
      cleanupPreviews(fixture.github, 'pr-123')
      assert.equal(fixture.releases.length, 0)
    } finally {
      fixture.dispose()
    }
  })

  it('does not mistake authentication failures for absent tags', () => {
    let fixture = createFixture()
    try {
      fixture.releases.push(fixture.release(1, fixture.manifest.tag))
      fixture.deleteDenied = true
      assert.throws(() => cleanupPreviews(fixture.github, 'pr-123'), /HTTP 403/)
      assert.equal(fixture.releases.length, 1)
    } finally {
      fixture.dispose()
    }
  })

  it('only reads releases during a cleanup dry run', () => {
    let fixture = createFixture()
    try {
      fixture.releases.push(fixture.release(1, fixture.manifest.tag))
      cleanupPreviews(fixture.github, 'pr-123', { dryRun: true })
      assert.equal(fixture.releases.length, 1)
      assert.equal(fixture.deletedTags.length, 0)
    } finally {
      fixture.dispose()
    }
  })

  it('validates source PR state before a caller can decide to delete', () => {
    let args: string[] = []
    let run: GitHubRunner = (command) => {
      args = command
      return JSON.stringify({ merged: false, head: { sha: 'a'.repeat(40) } })
    }
    assert.deepEqual(readPullRequest('remix-run/remix', 123, run), {
      merged: false,
      sha: 'a'.repeat(40),
    })
    assert.deepEqual(args, ['api', 'repos/remix-run/remix/pulls/123'])
    assert.throws(() => readPullRequest('remix-run/remix', 123, () => '{}'), /Invalid PR response/)
  })
})

function createFixture() {
  let directory = fs.mkdtempSync(path.join(os.tmpdir(), 'remix-preview-release-'))
  let tag = getPreviewTag('pr-123', 'a'.repeat(40))
  let manifest: PreviewManifest = {
    repository: 'remix-run/previews',
    sourceRepository: 'remix-run/remix',
    channel: 'pr-123',
    sha: 'a'.repeat(40),
    tag,
    createdAt: timestamp,
    packages: {
      remix: getPreviewTarballUrl(tag, 'remix'),
      '@remix-run/headers': getPreviewTarballUrl(tag, 'headers'),
    },
  }
  fs.writeFileSync(path.join(directory, 'remix.tgz'), 'remix package')
  fs.writeFileSync(path.join(directory, 'headers.tgz'), 'headers package')
  fs.writeFileSync(path.join(directory, 'preview.json'), JSON.stringify(manifest))
  let releases: PreviewRelease[] = []
  let assets: PreviewAsset[] = []
  let calls: string[][] = []
  let state: {
    failUpload: string
    corruptUpload: boolean
    tagMissing: '' | '404' | '422'
    deleteDenied: boolean
    publishedWithCompleteAssets: boolean
    createBody: Record<string, unknown> | undefined
  } = {
    failUpload: '',
    corruptUpload: false,
    tagMissing: '',
    deleteDenied: false,
    publishedWithCompleteAssets: false,
    createBody: undefined,
  }
  let deletedTags: string[] = []
  function release(id: number, tag_name: string): PreviewRelease {
    return {
      id,
      tag_name,
      body: PREVIEW_RELEASE_MARKER,
      draft: false,
      created_at: timestamp,
      published_at: timestamp,
    }
  }
  let run: GitHubRunner = (args, input) => {
    calls.push(args)
    if (args[0] === 'release') {
      let filename = args[3]
      if (path.basename(filename) === state.failUpload) throw new Error('upload failed')
      let data = fs.readFileSync(filename)
      assets.push({
        id: assets.length + 1,
        name: path.basename(filename),
        state: 'uploaded',
        size: data.length,
        digest: state.corruptUpload
          ? 'sha256:incorrect'
          : `sha256:${createHash('sha256').update(data).digest('hex')}`,
      })
      return ''
    }
    let method = args[2]
    let endpoint = args[3].replace('repos/remix-run/previews/', '')
    if (method === 'GET' && endpoint.startsWith('releases?')) {
      let page = Number(new URL(`https://example.com/${endpoint}`).searchParams.get('page'))
      return JSON.stringify(releases.slice((page - 1) * 100, page * 100))
    }
    if (method === 'GET' && endpoint.includes('/assets?')) return JSON.stringify(assets)
    if (method === 'POST' && endpoint === 'releases') {
      let body: Record<string, unknown> = JSON.parse(input ?? '{}')
      state.createBody = body
      let item = {
        ...release(releases.length + 1, String(body.tag_name)),
        draft: true,
        published_at: null,
        body: String(body.body),
      }
      releases.push(item)
      return JSON.stringify(item)
    }
    if (method === 'PATCH') {
      state.publishedWithCompleteAssets = assets.length === 3
      let item = releases.find((item) => endpoint === `releases/${item.id}`)
      if (!item) throw new Error('missing release')
      item.draft = false
      item.published_at = timestamp
      return JSON.stringify(item)
    }
    if (method === 'DELETE' && endpoint.startsWith('git/refs/tags/')) {
      if (state.deleteDenied) throw new Error('HTTP 403')
      if (state.tagMissing) {
        throw Object.assign(new Error('missing'), {
          stderr: `gh: ${state.tagMissing === '422' ? 'Reference does not exist' : 'Not Found'} (HTTP ${state.tagMissing})`,
        })
      }
      deletedTags.push(endpoint.slice('git/refs/tags/'.length))
      return ''
    }
    if (method === 'DELETE' && endpoint.startsWith('releases/assets/')) {
      assets.splice(
        assets.findIndex((asset) => endpoint === `releases/assets/${asset.id}`),
        1,
      )
      return ''
    }
    if (method === 'DELETE') {
      releases.splice(
        releases.findIndex((item) => endpoint === `releases/${item.id}`),
        1,
      )
      return ''
    }
    throw new Error(`Unexpected command: ${args.join(' ')}`)
  }
  return Object.assign(state, {
    directory,
    manifest,
    releases,
    assets,
    calls,
    deletedTags,
    release,
    github: new PreviewGitHub(manifest.repository, run),
    dispose() {
      fs.rmSync(directory, { recursive: true, force: true })
    },
  })
}
