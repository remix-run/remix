import { parseArgs } from 'node:util'

import { createPrComment, deletePrComment, getPrComments } from './utils/github.ts'
import { logAndExec } from './utils/process.ts'

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
let branch = `pr/${prNumber}`

if (command === 'comment') {
  await addPreviewComment()
} else if (command === 'cleanup') {
  await cleanupBranch()
} else {
  printUsage()
  throw new Error(`Unknown command: ${command}`)
}

function printUsage() {
  console.error('Usage: node pr-preview.ts <command> <args>')
  console.error('  comment <branch>  - Add preview comment to PR')
  console.error('  cleanup <branch>  - Delete branch from origin')
}

async function addPreviewComment() {
  let PREVIEW_COMMENT_MARKER = '<!-- pr-preview-comment -->'
  let commentBody = `${PREVIEW_COMMENT_MARKER}
## 📦 Preview Build Available

A preview build has been created for this PR. You can install it using:

\`\`\`sh
pnpm install "remix-run/remix#${branch}&path:packages/remix"
\`\`\`

This preview build will be updated automatically as you push new commits.`

  // Get existing comments
  let comments = await getPrComments(prNumber)
  console.log('Got comments', comments)

  // Find previous preview comment
  let previousComment = comments.find((comment) => comment.body?.includes(PREVIEW_COMMENT_MARKER))
  console.log('Got previous comment', previousComment)

  // Add new comment
  let commentData = await createPrComment(prNumber, commentBody)
  console.log('Created new comment', commentData)

  // Delete previous comment if it exists
  if (previousComment) {
    await deletePrComment(previousComment.id)
    console.log('Deleted previous comment', previousComment.id)
  }

  console.log(`Added preview comment to PR #${prNumber}`)
}

async function cleanupBranch() {
  await logAndExec(`git push --delete origin ${branch}`)
  console.log(`Deleted branch: ${branch}`)
}
