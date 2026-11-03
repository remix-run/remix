import { readFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'

import {
  PreviewGitHub,
  createGitHubRunner,
  readPullRequest,
  readPreviewManifest,
} from './utils/preview.ts'

const STICKY_MARKER = '<!-- pr-preview-comment-sticky -->'
const CLEANUP_MARKER = '<!-- pr-preview-comment-cleanup -->'
const { positionals } = parseArgs({ allowPositionals: true })
const [command, prNumberString] = positionals
const prNumber = Number(prNumberString)
if (
  positionals.length !== 2 ||
  !Number.isSafeInteger(prNumber) ||
  prNumber <= 0 ||
  !['comment', 'cleanup'].includes(command)
) {
  throw new Error('Usage: node scripts/pr-preview.ts <comment|cleanup> <pr-number>')
}
const repository = process.env.GITHUB_REPOSITORY ?? 'remix-run/remix'
const github = new PreviewGitHub(repository, createGitHubRunner(process.env.GITHUB_TOKEN))
const pr = readPullRequest(repository, prNumber)
let body: string
if (command === 'comment') {
  let preview = readPreviewManifest(await readFile('.preview/preview.json', 'utf8'))
  if (preview.channel !== `pr-${prNumber}` || preview.sourceRepository !== repository) {
    throw new Error('Preview metadata does not match this PR')
  }
  // Builds can finish out of order; only advertise the current head.
  if (pr.merged || pr.sha !== preview.sha) {
    console.log('Skipping preview comment for an obsolete PR head')
    process.exit(0)
  }
  body = `${STICKY_MARKER}
### Preview Build Available

A [preview build](https://github.com/${preview.repository}/releases/tag/${preview.tag}) is available for this PR:

\`\`\`sh
pnpm add "${preview.packages.remix}"
\`\`\`

Each SHA has its own build URL. All builds remain installable until this PR is merged, when their releases and tags are deleted. Closing without merging keeps the builds.

If your pnpm version blocks transitive Git or tarball dependencies, set \`blockExoticSubdeps: false\` in your \`pnpm-workspace.yaml\`.`
} else {
  if (!pr.merged) throw new Error('Cannot mark previews as removed for an unmerged PR')
  body = `${STICKY_MARKER}
### Preview Builds Removed

All preview releases for this PR have been deleted following its merge. Installs using those URLs need a newer preview URL and an updated lockfile.`
}

const comments: { id: number; body: string }[] = []
for (let page = 1; ; page++) {
  let result = github.api('GET', `issues/${prNumber}/comments?per_page=100&page=${page}`)
  if (!Array.isArray(result)) throw new Error('Invalid GitHub comments response')
  for (let comment of result) {
    if (
      typeof comment !== 'object' ||
      comment === null ||
      !('id' in comment) ||
      typeof comment.id !== 'number' ||
      !('body' in comment) ||
      typeof comment.body !== 'string'
    ) {
      throw new Error('Invalid GitHub comment')
    }
    comments.push({ id: comment.id, body: comment.body })
  }
  if (result.length < 100) break
}
const sticky = comments.find((comment) => comment.body.includes(STICKY_MARKER))
if (sticky) github.api('PATCH', `issues/comments/${sticky.id}`, { body })
else if (command === 'comment') github.api('POST', `issues/${prNumber}/comments`, { body })
for (let comment of comments.filter((comment) => comment.body.includes(CLEANUP_MARKER))) {
  github.delete(`issues/comments/${comment.id}`)
}
