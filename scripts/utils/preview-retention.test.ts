import assert from '@remix-run/assert'
import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, it } from '@remix-run/test'

import { getRetainedPreviewBuilds, readPreviewManifest } from './preview-retention.ts'

const oldSha = '1111111100000000000000000000000000000000'
const latestSha = '2222222200000000000000000000000000000000'
const now = Date.parse('2026-10-29T12:00:00Z')
const repository = path.resolve(import.meta.dirname, '../..')

describe('preview retention', () => {
  it('retains only the latest PR build regardless of age', () => {
    let builds = [
      { sha: oldSha, createdAt: '2026-10-29T00:00:00Z' },
      { sha: latestSha, createdAt: '2020-01-01T00:00:00Z' },
    ]
    assert.deepEqual(getRetainedPreviewBuilds('preview/pr-123', builds, latestSha, now), [
      builds[1],
    ])
  })

  it('discards all previous PR builds when publishing a new SHA', () => {
    let builds = [{ sha: oldSha, createdAt: '2026-10-29T00:00:00Z' }]
    assert.deepEqual(getRetainedPreviewBuilds('preview/pr-123', builds, latestSha, now), [])
  })

  it('preserves builds on custom preview branches', () => {
    let builds = [
      { sha: oldSha, createdAt: '2020-01-01T00:00:00Z' },
      { sha: latestSha, createdAt: '2026-10-29T00:00:00Z' },
    ]
    assert.deepEqual(getRetainedPreviewBuilds('experimental', builds, latestSha, now), builds)
  })

  it('expires main builds older than seven days and keeps the cutoff', () => {
    let builds = [
      { sha: oldSha, createdAt: '2026-10-22T11:59:59Z' },
      { sha: latestSha, createdAt: '2026-10-22T12:00:00Z' },
    ]
    assert.deepEqual(getRetainedPreviewBuilds('preview/main', builds, '3'.repeat(40), now), [
      builds[1],
    ])
  })

  it('keeps the latest main build even after seven days without a new build', () => {
    let builds = [{ sha: latestSha, createdAt: '2020-01-01T00:00:00Z' }]
    assert.deepEqual(getRetainedPreviewBuilds('preview/main', builds, latestSha, now), builds)
  })

  it('replaces PR tarballs on new source commits and preserves them on repeated builds', () => {
    let fixture = createFixture()
    try {
      let firstSha = fixture.git('rev-parse', 'HEAD')
      fixture.build('preview/pr-123', 'first')
      fixture.git('push', 'origin', 'HEAD:refs/heads/preview/pr-123')
      fixture.git('checkout', 'main')
      fs.writeFileSync(path.join(fixture.cwd, 'change.txt'), 'second source commit')
      fixture.git('add', '.')
      fixture.git('commit', '-m', 'second source')
      let secondSha = fixture.git('rev-parse', 'HEAD')
      fixture.build('preview/pr-123', 'second')
      assert.deepEqual(
        fixture.manifest().builds.map((build) => build.sha),
        [secondSha],
      )
      assert.equal(fs.existsSync(path.join(fixture.cwd, 't', firstSha.slice(0, 8))), false)
      assert.doesNotMatch(
        fixture.git('rev-list', '--objects', 'HEAD'),
        new RegExp(`t/${firstSha.slice(0, 8)}`),
      )
      assert.equal(fixture.git('rev-parse', 'HEAD^'), secondSha)
      fixture.git('push', '--force-with-lease', 'origin', 'HEAD:refs/heads/preview/pr-123')
      let currentTarball = fs.readFileSync(
        path.join(fixture.cwd, 't', secondSha.slice(0, 8), 'remix.tgz'),
      )
      let currentBuilds = fixture.manifest().builds
      fixture.git('checkout', 'main')
      fixture.build('preview/pr-123', 'must not repack')
      assert.deepEqual(
        fs.readFileSync(path.join(fixture.cwd, 't', secondSha.slice(0, 8), 'remix.tgz')),
        currentTarball,
      )
      assert.deepEqual(fixture.manifest().builds, currentBuilds)
    } finally {
      fixture.dispose()
    }
  })
})

function createFixture() {
  let root = fs.mkdtempSync(path.join(os.tmpdir(), 'remix-preview-retention-'))
  let cwd = path.join(root, 'source')
  let remote = path.join(root, 'remote.git')
  let bin = path.join(root, 'bin')
  fs.mkdirSync(cwd)
  fs.mkdirSync(bin)
  function git(...args: string[]): string {
    return cp.execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim()
  }
  git('init', '--bare', remote)
  git('init', '-b', 'main')
  git('config', 'user.name', 'Test')
  git('config', 'user.email', 'test@example.com')
  git('remote', 'add', 'origin', remote)
  fs.mkdirSync(path.join(cwd, 'packages/remix'), { recursive: true })
  fs.writeFileSync(
    path.join(cwd, 'packages/remix/package.json'),
    JSON.stringify({ name: 'remix', version: '1.0.0' }),
  )
  fs.writeFileSync(
    path.join(bin, 'pnpm'),
    `#!${process.execPath}
const fs = require('node:fs')
if (process.argv.includes('pack')) {
  fs.writeFileSync(process.argv[process.argv.indexOf('--out') + 1], process.env.PREVIEW_TEST_BUILD)
}
`,
    { mode: 0o755 },
  )
  git('add', '.')
  git('commit', '-m', 'initial source')
  git('push', 'origin', 'main')
  return {
    cwd,
    git,
    manifest() {
      return readPreviewManifest(fs.readFileSync(path.join(cwd, 't/preview.json'), 'utf8'), '')
    },
    build(branch: string, content: string) {
      cp.execFileSync(
        process.execPath,
        [path.join(repository, 'scripts/setup-installable-branch.ts'), branch],
        {
          cwd,
          encoding: 'utf8',
          stdio: 'pipe',
          env: {
            ...process.env,
            PATH: `${bin}${path.delimiter}${process.env.PATH}`,
            PREVIEW_TEST_BUILD: content,
          },
        },
      )
    },
    dispose() {
      fs.rmSync(root, { recursive: true, force: true })
    },
  }
}
