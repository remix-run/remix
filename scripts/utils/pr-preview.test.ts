import assert from '@remix-run/assert'
import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, it } from '@remix-run/test'

import { getPreviewTag, getPreviewTarballUrl } from './preview.ts'

const script = path.resolve(import.meta.dirname, '../pr-preview.ts')
const sha = 'a'.repeat(40)

describe('PR preview comments', () => {
  it('posts the completed release URL and merge-based retention policy', () => {
    let fixture = createFixture()
    try {
      fixture.run('comment')
      let post = fixture.calls().find((call) => call.args[2] === 'POST')
      assert.ok(post)
      let body: { body: string } = JSON.parse(post.input)
      assert.match(body.body, new RegExp(`releases/download/pr-123-${sha}/remix.tgz`))
      assert.match(body.body, /All builds remain installable until this PR is merged/)
      assert.match(body.body, /Closing without merging keeps the builds/)
      assert.equal(post.token, 'source-token')
    } finally {
      fixture.dispose()
    }
  })

  it('finds and updates an existing preview comment beyond the first page', () => {
    let fixture = createFixture()
    try {
      fixture.writeState({
        merged: false,
        sha,
        comments: [
          ...Array.from({ length: 100 }, (_, index) => ({
            id: index,
            body: 'A discussion comment',
          })),
          { id: 123, body: '<!-- pr-preview-comment-sticky --> previous build' },
        ],
      })
      fixture.run('comment')
      let calls = fixture.calls()
      assert.equal(
        calls.some((call) => call.args[2] === 'POST'),
        false,
      )
      assert.equal(
        calls.some(
          (call) =>
            call.args[2] === 'PATCH' &&
            call.args[3] === 'repos/remix-run/remix/issues/comments/123',
        ),
        true,
      )
    } finally {
      fixture.dispose()
    }
  })

  it('does not replace the current preview link with an older SHA', () => {
    let fixture = createFixture()
    try {
      fixture.writeState({ merged: false, sha: 'b'.repeat(40), comments: [] })
      fixture.run('comment')
      assert.equal(fixture.calls().length, 1)
    } finally {
      fixture.dispose()
    }
  })

  it('marks an existing preview comment as removed after merge', () => {
    let fixture = createFixture()
    try {
      fixture.writeState({
        merged: true,
        sha,
        comments: [{ id: 123, body: '<!-- pr-preview-comment-sticky --> old install link' }],
      })
      fixture.run('cleanup')
      let update = fixture.calls().find((call) => call.args[2] === 'PATCH')
      assert.ok(update)
      let body: { body: string } = JSON.parse(update.input)
      assert.match(body.body, /All preview releases for this PR have been deleted/)
      assert.doesNotMatch(body.body, /pnpm add/)
    } finally {
      fixture.dispose()
    }
  })
})

function createFixture() {
  let cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'remix-preview-comment-'))
  let bin = path.join(cwd, 'bin')
  let statePath = path.join(cwd, 'state.json')
  let callsPath = path.join(cwd, 'calls.jsonl')
  fs.mkdirSync(bin)
  fs.mkdirSync(path.join(cwd, '.preview'))
  let tag = getPreviewTag('pr-123', sha)
  fs.writeFileSync(
    path.join(cwd, '.preview/preview.json'),
    JSON.stringify({
      repository: 'remix-run/previews',
      sourceRepository: 'remix-run/remix',
      channel: 'pr-123',
      sha,
      tag,
      createdAt: '2026-11-02T00:00:00Z',
      packages: { remix: getPreviewTarballUrl(tag, 'remix') },
    }),
  )
  fs.writeFileSync(
    path.join(bin, 'gh'),
    `#!${process.execPath}
const fs = require('node:fs')
const args = process.argv.slice(2)
const input = fs.readFileSync(0, 'utf8')
fs.appendFileSync(process.env.PREVIEW_TEST_CALLS, JSON.stringify({args,input,token:process.env.GH_TOKEN}) + '\\n')
const state = JSON.parse(fs.readFileSync(process.env.PREVIEW_TEST_STATE, 'utf8'))
const endpoint = args[0] === 'api' && args[1].startsWith('repos/') ? args[1] : args[3]
if (endpoint === 'repos/remix-run/remix/pulls/123') {
  console.log(JSON.stringify({merged:state.merged,head:{sha:state.sha}}))
} else if (args[2] === 'GET') {
  const page = Number(new URL('https://example.com/' + endpoint).searchParams.get('page'))
  console.log(JSON.stringify(state.comments.slice((page - 1) * 100, page * 100)))
} else {
  console.log('{}')
}
`,
    { mode: 0o755 },
  )
  function writeState(state: {
    merged: boolean
    sha: string
    comments: { id: number; body: string }[]
  }) {
    fs.writeFileSync(statePath, JSON.stringify(state))
  }
  writeState({ merged: false, sha, comments: [] })
  return {
    writeState,
    run(command: string) {
      cp.execFileSync(process.execPath, [script, command, '123'], {
        cwd,
        stdio: 'pipe',
        env: {
          ...process.env,
          GITHUB_REPOSITORY: 'remix-run/remix',
          GITHUB_TOKEN: 'source-token',
          PREVIEW_TEST_STATE: statePath,
          PREVIEW_TEST_CALLS: callsPath,
          PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        },
      })
    },
    calls(): { args: string[]; input: string; token: string }[] {
      return fs
        .readFileSync(callsPath, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
    },
    dispose() {
      fs.rmSync(cwd, { recursive: true, force: true })
    },
  }
}
