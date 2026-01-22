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

import { parseArgs } from 'node:util'

import { createPrComment, deletePrComment, getPrComments } from './utils/github.ts'
import { logAndExec } from './utils/process.ts'

const STICKY_MARKER = '<!-- pr-preview-comment-sticky -->'
const CLEANUP_MARKER = '<!-- pr-preview-comment-cleanup -->'

let { positionals } = parseArgs({
  allowPositionals: true,
  strict: true,
})

if (positionals.length !== 2) {
  printUsage()
  process.exit(1)
}

let [command, prNumberString] = positionals
let prNumber = parseInt(prNumberString, 10)
if (isNaN(prNumber) || prNumber <= 0) {
  printUsage()
  throw new Error(`Invalid PR number: ${prNumberString}`)
}
let branch = `preview/${prNumber}`

let commands: Record<string, () => Promise<void>> = {
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
  console.error('  comment <branch>  - Add preview comment to PR')
  console.error('  cleanup <branch>  - Delete branch from origin')
}

async function comment() {
  let commentBody = `\
${STICKY_MARKER}
### Preview Build Available

A preview build has been created for this PR. You can install it using:

\`\`\`sh
pnpm install "remix-run/remix#${branch}&path:packages/remix"
\`\`\`

This preview build will be updated automatically as you push new commits.`

  // Get existing comments
  let comments = await getPrComments(prNumber)

  // Only add a comment if one doesn't already exist
  let stickyComment = comments.find((comment) => comment.body?.includes(STICKY_MARKER))
  if (stickyComment) {
    console.log('Preview comment already exists, skipping creation')
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
  await logAndExec(`git push --delete origin ${branch}`)

  let commentBody = `\
${CLEANUP_MARKER}
The preview branch (\`${branch}\`) has been deleted now that this PR is merged/closed.`

  console.log('Adding cleanup comment to PR')
  await createPrComment(prNumber, commentBody)
}
