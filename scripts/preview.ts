import { appendFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'

import {
  PREVIEW_REPOSITORY,
  PreviewGitHub,
  buildPreview,
  cleanupPrPreviewBranch,
  cleanupPreviews,
  createGitHubRunner,
  parsePreviewBuild,
  publishPreviewBuild,
  readPullRequest,
} from './utils/preview.ts'

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    'dry-run': { type: 'boolean', default: false },
    output: { type: 'string', default: '.preview' },
  },
})
const [command, target, sha] = positionals
const dryRun = values['dry-run']

if (command === 'build' && target && positionals.length === 2) {
  let build = await buildPreview(target, values.output, { dryRun })
  if (process.env.GITHUB_OUTPUT)
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `channel=${build.channel}\ntag=${build.tag}\nsha=${build.sha}\n`,
    )
} else if (command === 'publish' && target && sha && positionals.length === 3) {
  let build = parsePreviewBuild(target, sha)
  let published = publishPreviewBuild(client(), build, values.output, { dryRun })
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, `published=${published && !dryRun}\n`)
} else if (command === 'cleanup-branch' && target && positionals.length === 2) {
  cleanupPrPreviewBranch(
    new PreviewGitHub(
      process.env.GITHUB_REPOSITORY ?? 'remix-run/remix',
      createGitHubRunner(process.env.GITHUB_TOKEN),
    ),
    target,
    { dryRun },
  )
} else if (
  command === 'cleanup' &&
  target &&
  positionals.length === 2 &&
  /^(main|experimental|pr-[1-9]\d*)$/.test(target)
) {
  let pr = /^pr-([1-9]\d*)$/.exec(target)?.[1]
  if (
    !pr ||
    readPullRequest(process.env.GITHUB_REPOSITORY ?? 'remix-run/remix', Number(pr)).closed
  ) {
    cleanupPreviews(client(), target, { dryRun })
  } else {
    console.log(`Keeping previews for open PR #${pr}`)
  }
} else {
  throw new Error(
    'Usage: pnpm preview <build <main|pr-N|experimental>|publish <tag> <source-sha>|cleanup <main|experimental|pr-N>|cleanup-branch <pr-N>> [--dry-run] [--output <directory>]',
  )
}

function client(): PreviewGitHub {
  let token = process.env.REMIX_PREVIEWS_PAT
  if (!dryRun && !token)
    throw new Error('REMIX_PREVIEWS_PAT is required to publish or delete previews')
  return new PreviewGitHub(PREVIEW_REPOSITORY, createGitHubRunner(token))
}
