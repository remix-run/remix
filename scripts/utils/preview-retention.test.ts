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
  it('retains PR builds below the cap regardless of age', () => {
    let builds = [
      { sha: oldSha, createdAt: '2020-01-01T00:00:00Z' },
      { sha: latestSha, createdAt: '2026-10-29T00:00:00Z' },
    ]
    assert.deepEqual(getRetainedPreviewBuilds('preview/pr-123', builds, latestSha, now), builds)
  })

  it('reserves room for a new PR build and keeps the newest two previous builds', () => {
    let builds = Array.from({ length: 3 }, (_, index) => ({
      sha: index.toString(16).padStart(40, '0'),
      createdAt: new Date(now + index * 1000).toISOString(),
    }))
    assert.deepEqual(
      getRetainedPreviewBuilds('preview/pr-123', builds.toReversed(), latestSha, now),
      builds.slice(1).toReversed(),
    )
  })

  it('keeps three PR builds on a rerun without evicting the active SHA', () => {
    let builds = Array.from({ length: 4 }, (_, index) => ({
      sha: index.toString(16).padStart(40, '0'),
      createdAt: new Date(now + index * 1000).toISOString(),
    }))
    assert.deepEqual(getRetainedPreviewBuilds('preview/pr-123', builds, builds[0].sha, now), [
      builds[0],
      ...builds.slice(2),
    ])
  })

  it('does not apply the PR count cap to custom preview branches', () => {
    let builds = Array.from({ length: 4 }, (_, index) => ({
      sha: index.toString(16).padStart(40, '0'),
      createdAt: '2020-01-01T00:00:00Z',
    }))
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

  it('migrates a single-build manifest using its preview commit time', () => {
    let manifest = readPreviewManifest(
      JSON.stringify({ branch: 'preview/main', sha: oldSha, packages: {} }),
      '2026-10-20T00:00:00Z',
    )
    assert.deepEqual(manifest.builds, [{ sha: oldSha, createdAt: '2026-10-20T00:00:00Z' }])
  })

  it('rejects invalid timestamps and colliding SHA prefixes', () => {
    let manifest = { branch: 'preview/main', sha: oldSha, packages: {} }
    assert.throws(
      () =>
        readPreviewManifest(
          JSON.stringify({ ...manifest, builds: [{ sha: oldSha, createdAt: 'invalid' }] }),
          '',
        ),
      /Invalid or duplicate preview build/,
    )
    assert.throws(
      () =>
        readPreviewManifest(
          JSON.stringify({
            ...manifest,
            builds: [
              { sha: oldSha, createdAt: '2026-10-29T00:00:00Z' },
              { sha: oldSha.slice(0, 8) + 'f'.repeat(32), createdAt: '2026-10-29T00:00:00Z' },
            ],
          }),
          '',
        ),
      /Invalid or duplicate preview build/,
    )
  })

  it('retains exact PR tarballs across source commits and repeated builds without retaining preview history', () => {
    let fixture = createFixture()
    try {
      let firstSha = fixture.git('rev-parse', 'HEAD')
      fixture.build('preview/pr-123', 'first')
      let firstPreview = fixture.git('rev-parse', 'HEAD')
      let tarball = fs.readFileSync(path.join(fixture.cwd, 't', firstSha.slice(0, 8), 'remix.tgz'))
      fixture.git('push', 'origin', 'HEAD:refs/heads/preview/pr-123')
      fixture.git('checkout', 'main')
      fs.writeFileSync(path.join(fixture.cwd, 'change.txt'), 'second source commit')
      fixture.git('add', '.')
      fixture.git('commit', '-m', 'second source')
      let secondSha = fixture.git('rev-parse', 'HEAD')
      fixture.build('preview/pr-123', 'second')
      assert.deepEqual(
        fixture.manifest().builds.map((build) => build.sha),
        [firstSha, secondSha],
      )
      assert.deepEqual(
        fs.readFileSync(path.join(fixture.cwd, 't', firstSha.slice(0, 8), 'remix.tgz')),
        tarball,
      )
      assert.equal(fixture.git('rev-parse', 'HEAD^'), secondSha)
      assert.notEqual(fixture.git('rev-parse', 'HEAD^'), firstPreview)
      fixture.git('push', '--force-with-lease', 'origin', 'HEAD:refs/heads/preview/pr-123')
      let currentTarball = fs.readFileSync(
        path.join(fixture.cwd, 't', secondSha.slice(0, 8), 'remix.tgz'),
      )
      fixture.git('checkout', 'main')
      fixture.build('preview/pr-123', 'must not repack')
      assert.deepEqual(
        fs.readFileSync(path.join(fixture.cwd, 't', secondSha.slice(0, 8), 'remix.tgz')),
        currentTarball,
      )
      assert.equal(fixture.manifest().builds.length, 2)
    } finally {
      fixture.dispose()
    }
  })

  it('prunes PR artifacts beyond three builds from the snapshot and reachable history', () => {
    let fixture = createFixture()
    try {
      let sourceSha = fixture.git('rev-parse', 'HEAD')
      fixture.build('preview/pr-123', 'initial')
      let manifest = fixture.manifest()
      let previousBuilds = Array.from({ length: 3 }, (_, index) => ({
        sha: index.toString(16).padStart(8, '0') + '0'.repeat(32),
        createdAt: new Date(now + index * 1000).toISOString(),
      }))
      for (let build of previousBuilds) {
        let directory = path.join(fixture.cwd, 't', build.sha.slice(0, 8))
        fs.mkdirSync(directory)
        fs.writeFileSync(path.join(directory, 'remix.tgz'), build.sha)
      }
      fs.rmSync(path.join(fixture.cwd, 't', sourceSha.slice(0, 8)), { recursive: true })
      manifest.sha = previousBuilds[2].sha
      manifest.builds = previousBuilds
      fs.writeFileSync(path.join(fixture.cwd, 't/preview.json'), JSON.stringify(manifest))
      fixture.git('add', '.')
      fixture.git('commit', '-m', 'seed retained builds')
      fixture.git('push', 'origin', 'HEAD:refs/heads/preview/pr-123')
      fixture.git('checkout', 'main')

      fixture.build('preview/pr-123', 'new build')
      assert.deepEqual(
        fixture.manifest().builds.map((build) => build.sha),
        [...previousBuilds.slice(1).map((build) => build.sha), sourceSha],
      )
      assert.equal(fs.existsSync(path.join(fixture.cwd, 't/00000000')), false)
      assert.doesNotMatch(fixture.git('rev-list', '--objects', 'HEAD'), /t\/00000000/)
      assert.equal(
        fs.readFileSync(path.join(fixture.cwd, 't/00000001/remix.tgz'), 'utf8'),
        previousBuilds[1].sha,
      )
    } finally {
      fixture.dispose()
    }
  })

  it('replaces previews using the old artifact layout without retaining old paths', () => {
    let fixture = createFixture()
    try {
      let sourceSha = fixture.git('rev-parse', 'HEAD')
      fixture.git('checkout', '-b', 'preview/pr-123')
      fs.writeFileSync(path.join(fixture.cwd, 'old-build.js'), 'old preview output')
      fs.mkdirSync(path.join(fixture.cwd, 'tarballs'))
      fs.writeFileSync(path.join(fixture.cwd, 'tarballs/preview.json'), '{}')
      fixture.git('add', '.')
      fixture.git('commit', '-m', 'legacy preview')
      fixture.git('push', 'origin', 'HEAD:refs/heads/preview/pr-123')
      fixture.git('checkout', 'main')
      fixture.build('preview/pr-123', 'tarball')
      assert.deepEqual(
        fixture.manifest().builds.map((build) => build.sha),
        [sourceSha],
      )
      assert.equal(fs.existsSync(path.join(fixture.cwd, 'old-build.js')), false)
      assert.equal(fs.existsSync(path.join(fixture.cwd, 'tarballs')), false)
      fixture.git('push', '--force-with-lease', 'origin', 'HEAD:refs/heads/preview/pr-123')
    } finally {
      fixture.dispose()
    }
  })

  it('rejects a push when another writer updates the preview after retention is loaded', () => {
    let fixture = createFixture()
    try {
      let sourceSha = fixture.git('rev-parse', 'HEAD')
      fixture.build('preview/pr-123', 'first')
      fixture.git('push', 'origin', 'HEAD:refs/heads/preview/pr-123')
      fixture.git('checkout', 'main')
      fixture.build('preview/pr-123', 'second')
      fixture.git(
        '--git-dir',
        path.join(fixture.cwd, '../remote.git'),
        'update-ref',
        'refs/heads/preview/pr-123',
        sourceSha,
      )
      assert.throws(
        () => fixture.git('push', '--force-with-lease', 'origin', 'HEAD:refs/heads/preview/pr-123'),
        /stale info/,
      )
    } finally {
      fixture.dispose()
    }
  })

  it('prunes main builds on updates and preserves exact tarballs when reusing an old latest build', () => {
    let fixture = createFixture()
    try {
      let firstSha = fixture.git('rev-parse', 'HEAD')
      fixture.build('preview/main', 'first')
      fixture.ageBuild(firstSha)
      fixture.git('push', 'origin', 'HEAD:refs/heads/preview/main')
      fixture.git('checkout', 'main')
      fs.writeFileSync(path.join(fixture.cwd, 'change.txt'), 'second source commit')
      fixture.git('add', '.')
      fixture.git('commit', '-m', 'second source')
      let secondSha = fixture.git('rev-parse', 'HEAD')
      fixture.build('preview/main', 'second')
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

      let latestTarball = fs.readFileSync(
        path.join(fixture.cwd, 't', secondSha.slice(0, 8), 'remix.tgz'),
      )
      fixture.ageBuild(secondSha)
      let originalBuildTime = fixture.manifest().builds[0].createdAt
      fixture.git('push', '--force-with-lease', 'origin', 'HEAD:refs/heads/preview/main')
      fixture.git('checkout', 'main')
      fixture.build('preview/main', 'must not repack')
      assert.deepEqual(fixture.manifest().builds, [
        { sha: secondSha, createdAt: originalBuildTime },
      ])
      assert.deepEqual(
        fs.readFileSync(path.join(fixture.cwd, 't', secondSha.slice(0, 8), 'remix.tgz')),
        latestTarball,
      )
      assert.equal(fixture.git('rev-parse', 'HEAD^'), secondSha)
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
  function runScript(name: string, args: string[] = [], build = '') {
    cp.execFileSync(process.execPath, [path.join(repository, 'scripts', name), ...args], {
      cwd,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        PREVIEW_TEST_BUILD: build,
      },
    })
  }
  function manifest() {
    return readPreviewManifest(fs.readFileSync(path.join(cwd, 't/preview.json'), 'utf8'), '')
  }
  return {
    cwd,
    git,
    manifest,
    build(branch: string, content: string) {
      runScript('setup-installable-branch.ts', [branch], content)
    },
    ageBuild(sha: string) {
      let value = manifest()
      for (let build of value.builds)
        if (build.sha === sha) build.createdAt = '2020-01-01T00:00:00Z'
      fs.writeFileSync(path.join(cwd, 't/preview.json'), JSON.stringify(value))
      git('add', '.')
      git('commit', '-m', 'age fixture build')
    },
    dispose() {
      fs.rmSync(root, { recursive: true, force: true })
    },
  }
}
