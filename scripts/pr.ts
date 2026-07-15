/**
 * Checks a PR and applies the resulting trusted comment.
 *
 * Two-phase to avoid running with write permissions on PRs from forks.
 * See https://securitylab.github.com/resources/github-actions-preventing-pwn-requests/
 *
 *   check    Inspects the PR via the GitHub API and writes a trusted comment
 *            reference to the given result file. Safe to run with a
 *            read-only token (Workflow A: 🔍 Check PR).
 *
 *   actions  Reads the given result file and applies the referenced comment. Runs
 *            in Workflow B (PR Actions) under `workflow_run` with
 *            write permissions but never executes any PR code.
 *
 * Usage:
 *   node scripts/pr.ts check <result-file>
 *   node scripts/pr.ts actions <result-file>
 *
 * Environment (check):
 *   GITHUB_TOKEN  - Required (read-only PR scope is enough).
 *   PR_NUMBER     - Required. github.event.pull_request.number
 *   PR_BASE       - Required. github.event.pull_request.base.ref
 *
 * Environment (actions):
 *   GITHUB_TOKEN  - Required (issues:write).
 */
import * as fs from 'node:fs'
import * as util from 'node:util'

import { createPrComment, getPrComments, getPrFiles, updatePrComment } from './utils/github.ts'

type CheckContext = {
  prNumber: number
  baseBranch: string
}

interface PrComment {
  marker: string
  body: string
}

interface PrCheckArtifact {
  prNumber: number
  comment: PrCommentId | null
}

type PrCommentId = 'change-file-found' | 'change-file-missing'

const CHANGE_FILE_MARKER = '<!-- change-file-check -->'

const CHANGE_FILE_MISSING_COMMENT = `\
### ⚠️ No Change File Found

This PR doesn't include a [change file](https://github.com/remix-run/remix/blob/main/CONTRIBUTING.md#adding-a-change-file) which is used for automated release notes.
If your change affects users, please add one (or more) change files and commit the generated file(s).

\`\`\`sh
pnpm changes:add
\`\`\`

> This script requires Node 24+. If you are on a lower version, please [add a file manually](https://github.com/remix-run/remix/blob/main/CONTRIBUTING.md#adding-a-change-file)

> Not every PR needs a change file — you can skip this step if the change is internal-only
> (tests, tooling, docs)`

const CHANGE_FILE_FOUND_COMMENT = `\
### ✅ Change File Found

One or more [change files](https://github.com/remix-run/remix/blob/main/CONTRIBUTING.md#adding-a-change-file) found.
`

const comments: Record<PrCommentId, PrComment> = {
  'change-file-found': {
    marker: CHANGE_FILE_MARKER,
    body: `${CHANGE_FILE_MARKER}\n${CHANGE_FILE_FOUND_COMMENT}`,
  },
  'change-file-missing': {
    marker: CHANGE_FILE_MARKER,
    body: `${CHANGE_FILE_MARKER}\n${CHANGE_FILE_MISSING_COMMENT}`,
  },
}

const { positionals } = util.parseArgs({ allowPositionals: true })
const [mode, filename] = positionals

if (!filename) {
  usage()
}

if (mode === 'check') {
  await runChecks()
} else if (mode === 'actions') {
  await runActions()
} else {
  usage()
}

// ---------- Checks ----------

async function runChecks() {
  let prNumber = parseInt(requireEnv('PR_NUMBER'), 10)
  if (isNaN(prNumber)) {
    console.error('PR_NUMBER must be numeric')
    process.exit(1)
  }

  let ctx: CheckContext = {
    prNumber,
    baseBranch: requireEnv('PR_BASE'),
  }
  console.log('ctx:', ctx)

  let result: PrCheckArtifact = {
    prNumber,
    comment: await changeFileCheck(ctx),
  }

  console.log(`Checks result:`)
  console.log(
    JSON.stringify(
      result,
      (_, value) =>
        typeof value === 'string' && value.length > 60 ? value.substring(0, 60) + '...' : value,
      2,
    ),
  )

  console.log(`Writing ${filename}`)
  fs.writeFileSync(filename, JSON.stringify(result))
}

async function changeFileCheck(ctx: CheckContext): Promise<PrCommentId | null> {
  if (ctx.baseBranch !== 'main') return null

  let files = await getPrFiles(ctx.prNumber)
  let touchesPackageFiles = files.some((f) => f.filename.startsWith('packages/'))
  let regex = /^packages\/[^/]+\/\.changes\/(major|minor|patch)\.[^/]+\.md$/
  let hasChangeFile = files.some((file) => file.status !== 'removed' && regex.test(file.filename))

  console.log(`changeFileCheck: found change file: ${hasChangeFile}`)

  if (!hasChangeFile && !touchesPackageFiles) {
    console.log('changeFileCheck: no package files changed')
    return null
  }

  return hasChangeFile ? 'change-file-found' : 'change-file-missing'
}

// ---------- Action dispatch ----------

async function runActions() {
  if (!fs.existsSync(filename)) {
    console.log(`No result file found at ${filename}; skipping actions`)
    return
  }

  let artifact: unknown = JSON.parse(fs.readFileSync(filename, 'utf8'))
  let { prNumber, comment } = parsePrCheckArtifact(artifact)

  if (comment === null) {
    console.log('No comment to apply')
    return
  }

  console.log(`Applying comment: ${comment}`)
  let { marker, body } = getPrComment(comment)
  let comments = await getPrComments(prNumber)
  let existing = comments.find(
    (candidate) =>
      candidate.user?.login === 'github-actions[bot]' && candidate.body?.includes(marker),
  )
  if (existing) {
    console.log(`Updating sticky comment #${existing.id}`)
    await updatePrComment(existing.id, body)
  } else {
    console.log('Creating sticky comment')
    await createPrComment(prNumber, body)
  }
}

function getPrComment(commentId: PrCommentId): PrComment {
  return comments[commentId]
}

function parsePrCheckArtifact(value: unknown): PrCheckArtifact {
  if (!isRecord(value) || !hasExactKeys(value, ['prNumber', 'comment'])) {
    throw new TypeError('Invalid PR check artifact')
  }

  let { prNumber, comment } = value
  if (
    typeof prNumber !== 'number' ||
    !Number.isSafeInteger(prNumber) ||
    prNumber <= 0 ||
    (comment !== null && !isPrCommentId(comment))
  ) {
    throw new TypeError('Invalid PR check artifact')
  }

  return { prNumber, comment }
}

function isPrCommentId(value: unknown): value is PrCommentId {
  return typeof value === 'string' && Object.hasOwn(comments, value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: string[]): boolean {
  let keys = Object.keys(value)
  return keys.length === expectedKeys.length && expectedKeys.every((key) => keys.includes(key))
}

// Utils

function usage(): never {
  console.error(
    'Usage:\n' +
      '  node scripts/pr.ts check <result-file>\n' +
      '  node scripts/pr.ts actions <result-file>',
  )
  process.exit(1)
}

function requireEnv(name: string): string {
  let value = process.env[name]
  if (!value) {
    console.error(`Missing required env var: ${name}`)
    process.exit(1)
  }
  return value
}
