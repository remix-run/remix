import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { getNodeVersions, getReleaseVersion, readUpstreamArchive } from './update-uwebsockets.ts'

const commit = '1234567890abcdef1234567890abcdef12345678'
const sourceCommit = 'abcdef1234567890abcdef1234567890abcdef12'
const archiveFiles = {
  LICENSE: 'Apache-2.0',
  'uws.js': 'module.exports = {}',
  'ESM_wrapper.mjs': 'export default {}',
  'index.d.ts': 'export function App(): unknown',
  source_commit: sourceCommit + '\n',
  ...Object.fromEntries(
    ['darwin_arm64', 'darwin_x64', 'linux_arm64', 'linux_x64', 'win32_x64'].flatMap((platform) =>
      [127, 137, 147].map((abi) => [`uws_${platform}_${abi}.node`, 'native binary']),
    ),
  ),
}

function createArchive(files: Record<string, string>): Buffer {
  let dir = fs.mkdtempSync(path.join(os.tmpdir(), 'remix-uws-update-'))
  let prefix = `uNetworking-uWebSockets.js-${commit.slice(0, 7)}`
  try {
    fs.mkdirSync(path.join(dir, prefix))
    for (let [file, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, prefix, file), content)
    }
    return execFileSync('tar', ['-czf', '-', '-C', dir, prefix])
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

function verifySyncedFacade(wrapper: string): void {
  let dir = fs.mkdtempSync(path.join(os.tmpdir(), 'remix-uws-facade-'))
  let archive = createArchive({ ...archiveFiles, 'ESM_wrapper.mjs': wrapper })
  try {
    fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true })
    fs.copyFileSync(
      new URL('./sync-uwebsockets.ts', import.meta.url),
      path.join(dir, 'scripts/sync-uwebsockets.ts'),
    )
    fs.mkdirSync(path.join(dir, 'packages/uwebsockets-js/src'), { recursive: true })
    fs.mkdirSync(path.join(dir, '.tmp/uwebsockets'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ type: 'module' }))
    fs.writeFileSync(
      path.join(dir, 'packages/uwebsockets-js/package.json'),
      JSON.stringify({ optionalDependencies: {} }),
    )
    fs.writeFileSync(
      path.join(dir, 'packages/uwebsockets-js/upstream.json'),
      JSON.stringify({
        version: '20.71.0',
        commit,
        sourceCommit,
        nodeAbis: [127, 137, 147],
        archiveSha256: createHash('sha256').update(archive).digest('hex'),
      }),
    )
    fs.writeFileSync(path.join(dir, `.tmp/uwebsockets/${commit}.tar.gz`), archive)
    fs.writeFileSync(
      path.join(dir, 'packages/uwebsockets-js/src/index.cjs'),
      'module.exports = { DeclarativeResponse: class DeclarativeResponse {} }',
    )
    execFileSync(process.execPath, ['scripts/sync-uwebsockets.ts', '--facade'], { cwd: dir })
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        'import { DeclarativeResponse } from "./packages/uwebsockets-js/src/index.mjs"; new DeclarativeResponse()',
      ],
      { cwd: dir },
    )
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

describe('uWebSockets.js release selection', () => {
  it('selects a newer stable release', () => {
    assert.equal(
      getReleaseVersion({ tag_name: 'v20.71.0', draft: false, prerelease: false }, '20.66.0'),
      '20.71.0',
    )
  })

  it('does not downgrade a newer manual pin', () => {
    assert.equal(
      getReleaseVersion({ tag_name: 'v20.66.0', draft: false, prerelease: false }, '20.71.0'),
      null,
    )
  })

  it('leaves an up-to-date pin unchanged', () => {
    assert.equal(
      getReleaseVersion({ tag_name: 'v20.71.0', draft: false, prerelease: false }, '20.71.0'),
      null,
    )
  })

  it('ignores draft releases', () => {
    assert.equal(
      getReleaseVersion({ tag_name: 'v20.71.0', draft: true, prerelease: false }, '20.66.0'),
      null,
    )
  })

  it('ignores prereleases', () => {
    assert.equal(
      getReleaseVersion({ tag_name: 'v20.71.0', draft: false, prerelease: true }, '20.66.0'),
      null,
    )
  })

  it('ignores prerelease tags even if the release is marked stable', () => {
    assert.equal(
      getReleaseVersion(
        { tag_name: 'v20.71.0-beta.1', draft: false, prerelease: false },
        '20.66.0',
      ),
      null,
    )
  })

  it('rejects malformed release metadata', () => {
    assert.throws(
      () => getReleaseVersion({ tag_name: 'v20.71.0' }, '20.66.0'),
      /Invalid upstream release/,
    )
    assert.throws(
      () => getReleaseVersion({ tag_name: 'latest', draft: false, prerelease: false }, '20.66.0'),
      /Invalid upstream version/,
    )
  })
})

describe('uWebSockets.js upstream archive verification', () => {
  it('pins the archive checksum, native source commit, and complete ABI matrix', () => {
    let archive = createArchive(archiveFiles)
    assert.deepEqual(readUpstreamArchive(commit, archive), {
      sourceCommit,
      nodeAbis: [127, 137, 147],
      archiveSha256: createHash('sha256').update(archive).digest('hex'),
    })
  })

  it('rejects an ABI missing from one supported platform', () => {
    let files: Record<string, string> = { ...archiveFiles }
    delete files['uws_win32_x64_137.node']
    assert.throws(
      () => readUpstreamArchive(commit, createArchive(files)),
      /missing uws_win32_x64_137.node/,
    )
  })

  it('rejects an archive with no native binaries', () => {
    let files = {
      LICENSE: archiveFiles.LICENSE,
      'uws.js': archiveFiles['uws.js'],
      'ESM_wrapper.mjs': archiveFiles['ESM_wrapper.mjs'],
      'index.d.ts': archiveFiles['index.d.ts'],
      source_commit: sourceCommit,
    }
    assert.throws(
      () => readUpstreamArchive(commit, createArchive(files)),
      /no supported native binaries/,
    )
  })

  it('rejects missing upstream files', () => {
    let files: Record<string, string> = { ...archiveFiles }
    delete files.LICENSE
    assert.throws(() => readUpstreamArchive(commit, createArchive(files)), /missing LICENSE/)
  })

  it('rejects invalid native source attribution', () => {
    assert.throws(
      () =>
        readUpstreamArchive(commit, createArchive({ ...archiveFiles, source_commit: 'latest' })),
      /Invalid upstream native source commit/,
    )
  })

  it('rejects invalid distribution commits before reading an archive', () => {
    assert.throws(
      () => readUpstreamArchive('latest', new Uint8Array()),
      /Invalid upstream distribution commit/,
    )
  })
})

describe('uWebSockets.js Node support documentation', () => {
  it('documents the Node versions for the upstream ABI matrix', () => {
    assert.equal(getNodeVersions([127, 137, 147]), '22, 24, 26')
  })

  it('requires a documented Node version before updating to an unknown ABI', () => {
    assert.throws(() => getNodeVersions([137, 999]), /Document the Node.js version for new ABI 999/)
  })
})

describe('uWebSockets.js facade synchronization', () => {
  it('supplies DeclarativeResponse when older wrappers omit it', () => {
    verifySyncedFacade('import uws from "./uws.js";\nexport default uws;\n')
  })

  it('loads newer wrappers that already export DeclarativeResponse', () => {
    verifySyncedFacade(
      "import uws from './index.js';\nexport default uws;\nexport const DeclarativeResponse = uws.DeclarativeResponse;\n",
    )
  })
})
