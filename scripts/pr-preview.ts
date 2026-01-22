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

const PREVIEW_COMMENT_MARKER = '<!-- pr-preview-comment -->'

async function comment() {
  let commentBody = `${PREVIEW_COMMENT_MARKER}
### Preview Build Available

A preview build has been created for this PR. You can install it using:

\`\`\`sh
pnpm install "remix-run/remix#${branch}&path:packages/remix"
\`\`\`

This preview build will be updated automatically as you push new commits.`

  // Get existing comments
  let comments = await getPrComments(prNumber)
  let priorComments = comments.filter((comment) => comment.body?.includes(PREVIEW_COMMENT_MARKER))

  // Add new comment
  await createPrComment(prNumber, commentBody)

  // Delete any previous comments
  for (let comment of priorComments) {
    await deletePrComment(comment.id)
  }

  console.log(`Added preview comment to PR #${prNumber}`)
}

async function cleanup() {
  await logAndExec(`git push --delete origin ${branch}`)

  let commentBody = `${PREVIEW_COMMENT_MARKER}
The preview build branch has been deleted now that this PR is merged/closed.`

  await createPrComment(prNumber, commentBody)

  console.log(`Deleted branch: ${branch}`)
}
