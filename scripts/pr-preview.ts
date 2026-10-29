/**
 * PR Preview Script
 *
 * This script manages preview builds for pull requests by:
 * - Creating comments on PRs with installation instructions for preview builds
 * - Cleaning up preview branches when PRs are merged or closed
 *
 * Commands:
 * - `comment <pr-number>`: Adds a comment to the specified PR with instructions
 *   to install the preview build. Updates any existing preview comments.
 * - `cleanup <pr-number>`: Deletes the preview branch from the remote repository
 *   and adds a cleanup notification comment to the PR.
 *
 * Usage: `node pr-preview.ts <command> <pr-number>`
 */

import { readFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'

import { createPrComment, deletePrComment, getPrComments, updatePrComment } from './utils/github.ts'
import { logAndExec } from './utils/process.ts'
import { getPreviewTarballUrl } from './utils/preview.ts'

const STICKY_MARKER = '<!-- pr-preview-comment-sticky -->'
const CLEANUP_MARKER = '<!-- pr-preview-comment-cleanup -->'

const { positionals } = parseArgs({
  allowPositionals: true,
  strict: true,
})

if (positionals.length !== 3) {
  printUsage()
  process.exit(1)
}

const [command, prNumberString, branch] = positionals
const prNumber = parseInt(prNumberString, 10)
if (isNaN(prNumber) || prNumber <= 0) {
  printUsage()
  throw new Error(`Invalid PR number: ${prNumberString}`)
}

const commands: Record<string, () => Promise<void>> = {
  comment,
  cleanup,
}

if (commands[command]) {
  await commands[command]()
} else {
  printUsage()
  throw new Error(`Unknown command: ${command}`)
}

function printUsage() {
  console.error('Usage: node pr-preview.ts <command> <args>')
  console.error('  comment <pr-number> <preview-branch> - Add preview comment to PR')
  console.error('  cleanup <pr-number> <preview-branch> - Delete branch from origin')
}

async function comment() {
  let preview: { branch: string; sha: string } = JSON.parse(
    await readFile('tarballs/preview.json', 'utf-8'),
  )
  if (preview.branch !== branch) {
    throw new Error(`Preview metadata is for ${preview.branch}, not ${branch}`)
  }
  let url = getPreviewTarballUrl(branch, preview.sha, 'remix', process.env.GITHUB_REPOSITORY)
  let commentBody = `\
${STICKY_MARKER}
### Preview Build Available

A preview build has been created for this PR. You can install it using:

\`\`\`sh
pnpm add "${url}"
\`\`\`

Each push creates a new build URL and updates this comment. Previous builds remain installable until this PR is merged or closed, when the preview branch is deleted.

If your pnpm version blocks transitive Git or tarball dependencies, set \`blockExoticSubdeps: false\` in your \`pnpm-workspace.yaml\`.`

  // Get existing comments
  let comments = await getPrComments(prNumber)

  // Only add a comment if one doesn't already exist
  let stickyComment = comments.find((comment) => comment.body?.includes(STICKY_MARKER))
  if (stickyComment) {
    console.log('Updating preview comment on PR')
    await updatePrComment(stickyComment.id, commentBody)
  } else {
    console.log('Adding preview comment to PR')
    await createPrComment(prNumber, commentBody)
  }

  // Delete cleanup comment if it exists
  let cleanupComment = comments.find((comment) => comment.body?.includes(CLEANUP_MARKER))
  if (cleanupComment) {
    console.log('Deleting existing cleanup comment')
    await deletePrComment(cleanupComment.id)
  }
}

async function cleanup() {
  console.log(`Deleted branch: ${branch}`)
  logAndExec('git', ['push', '--delete', 'origin', branch])

  let commentBody = `\
${CLEANUP_MARKER}
The preview branch \`${branch}\` has been deleted now that this PR is merged/closed.`

  console.log('Adding cleanup comment to PR')
  await createPrComment(prNumber, commentBody)
}
