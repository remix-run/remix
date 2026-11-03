import { appendFile, readFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'

import { buildPreview } from './utils/preview-build.ts'
import {
  PreviewGitHub,
  cleanupPreviews,
  createGitHubRunner,
  publishPreviewBuild,
  readPullRequest,
} from './utils/preview-releases.ts'
import { readPreviewManifest } from './utils/preview.ts'

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    'dry-run': { type: 'boolean', default: false },
    output: { type: 'string', default: '.preview' },
  },
})
const [command, channel] = positionals
const dryRun = values['dry-run']
const repository = process.env.REMIX_PREVIEWS_REPOSITORY ?? 'remix-run/previews'

if (command === 'build' && channel && positionals.length === 2) {
  await buildPreview(channel, values.output, { dryRun, repository })
} else if (command === 'publish' && positionals.length === 1) {
  let manifest = readPreviewManifest(await readFile(`${values.output}/preview.json`, 'utf8'))
  let published = publishPreviewBuild(client(), manifest, values.output, { dryRun })
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, `published=${published && !dryRun}\n`)
} else if (
  command === 'cleanup' &&
  channel &&
  positionals.length === 2 &&
  /^(main|pr-[1-9]\d*)$/.test(channel)
) {
  let pr = /^pr-([1-9]\d*)$/.exec(channel)?.[1]
  if (
    !pr ||
    readPullRequest(process.env.GITHUB_REPOSITORY ?? 'remix-run/remix', Number(pr)).merged
  ) {
    cleanupPreviews(client(), channel, { dryRun })
  } else {
    console.log(`Keeping previews for unmerged PR #${pr}`)
  }
} else {
  throw new Error(
    'Usage: pnpm preview <build <main|pr-N|experimental-name>|publish|cleanup <main|pr-N>> [--dry-run] [--output <directory>]',
  )
}

function client(): PreviewGitHub {
  let token = process.env.REMIX_PREVIEWS_PAT
  if (!dryRun && !token)
    throw new Error('REMIX_PREVIEWS_PAT is required to publish or delete previews')
  return new PreviewGitHub(repository, createGitHubRunner(token))
}
