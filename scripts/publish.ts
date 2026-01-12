/**
 * Publishes packages to npm and creates tags/releases for what was published.
 * This script runs pnpm publish with --report-summary, reads the summary file,
 * and creates Git tags + GitHub releases.
 *
 * This script is designed for CI use. For previewing releases, use `pnpm changes:preview`.
 *
 * Usage:
 *   node scripts/publish.ts [--skip-ci-check]
 *
 * Options:
 *   --skip-ci-check  Bypass the CI environment check
 */
import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

import { tagExists } from './utils/git.ts'
import { createRelease } from './utils/github.ts'
import { getRootDir, logAndExec } from './utils/process.ts'

let rootDir = getRootDir()

let args = process.argv.slice(2)
let skipCiCheck = args.includes('--skip-ci-check')

interface PublishedPackage {
  packageName: string
  version: string
  tag: string
}

interface PublishSummary {
  publishedPackages: Array<{
    name: string
    version: string
  }>
}

/**
 * Read published packages from pnpm's publish summary file.
 * See https://pnpm.io/cli/publish#--report-summary
 */
function readPublishSummary(): PublishedPackage[] {
  let summaryPath = path.join(rootDir, 'pnpm-publish-summary.json')

  if (!fs.existsSync(summaryPath)) {
    throw new Error(
      `pnpm-publish-summary.json not found. This is unexpected after a successful publish.`,
    )
  }

  let summary: PublishSummary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'))

  return summary.publishedPackages.map((pkg) => ({
    packageName: pkg.name,
    version: pkg.version,
    tag: `${pkg.name}@${pkg.version}`,
  }))
}

async function main() {
  // Safety check: this script should only run in CI
  if (!process.env.CI && !skipCiCheck) {
    console.error('The publish script is designed for CI use only.')
    console.error('Use --skip-ci-check to bypass this check for local use.')
    console.error('\nFor previewing releases, use: pnpm changes:preview')
    process.exit(1)
  }

  // Run pnpm publish with --report-summary to get a JSON file of what was published
  console.log('Publishing packages to npm...\n')
  logAndExec('pnpm publish --recursive --access public --no-git-checks --report-summary')

  // Read the summary file to find what was published
  let published = readPublishSummary()

  if (published.length === 0) {
    console.log('\nNo packages were published.')
    return
  }

  console.log(`\n${published.length} package${published.length === 1 ? '' : 's'} published:`)
  for (let pkg of published) {
    console.log(`  • ${pkg.packageName}@${pkg.version}`)
  }

  // Configure git
  console.log('\nConfiguring git...')
  logAndExec('git config user.name "Remix Run Bot"')
  logAndExec('git config user.email "hello@remix.run"')

  // Create tags (skip if already exist)
  console.log(`\nCreating tag${published.length === 1 ? '' : 's'}...`)
  let tagsCreated = 0
  for (let pkg of published) {
    if (tagExists(pkg.tag)) {
      console.log(`  ⊘ ${pkg.tag} (already exists)`)
    } else {
      cp.execSync(`git tag ${pkg.tag}`)
      console.log(`  ✓ ${pkg.tag}`)
      tagsCreated++
    }
  }

  // Push tags if any were created
  if (tagsCreated > 0) {
    console.log(`\nPushing tag${tagsCreated === 1 ? '' : 's'}...`)
    logAndExec('git push --tags')
  } else {
    console.log('\nNo new tags to push.')
  }

  // Create GitHub releases (skip if already exists)
  console.log('\nCreating GitHub releases...')
  let failedReleases: Array<{ pkg: PublishedPackage; error: string }> = []

  for (let pkg of published) {
    let result = await createRelease(pkg.packageName, pkg.version)
    if (result.status === 'created') {
      console.log(`  ✓ ${pkg.packageName} v${pkg.version}`)
    } else if (result.status === 'skipped') {
      console.log(`  ⊘ ${pkg.packageName} v${pkg.version} (${result.reason.toLowerCase()})`)
    } else {
      console.log(`  ✗ ${pkg.packageName} v${pkg.version} (failed)`)
      failedReleases.push({ pkg, error: result.error })
    }
  }

  // Report any failures
  if (failedReleases.length > 0) {
    console.error('\n⚠️  Some GitHub releases failed to create:')
    for (let { pkg, error } of failedReleases) {
      console.error(`  • ${pkg.packageName} v${pkg.version}: ${error}`)
    }
    console.error('\nYou may need to create these releases manually.')
    process.exit(1)
  }

  console.log('\n✅ Done.')
}

main()
