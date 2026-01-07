/**
 * Creates tags for packages that were versioned in the last commit.
 * Run this after a version PR is merged to trigger the publish workflow.
 *
 * Usage:
 *   node scripts/changes-version-pr-complete.ts [--preview]
 */
import * as cp from 'node:child_process'
import { getAllPackageNames, getPackageFile } from './utils/packages.ts'
import { readJson } from './utils/fs.ts'
import { getHeadCommitMessage, getFileAtRef } from './utils/git.ts'
import { logAndExec } from './utils/process.ts'

let args = process.argv.slice(2)
let preview = args.includes('--preview')

interface VersionedPackage {
  packageName: string
  version: string
  tag: string
}

function getVersionedPackages(): VersionedPackage[] {
  let packageNames = getAllPackageNames()
  let versioned: VersionedPackage[] = []

  for (let packageName of packageNames) {
    let currentVersion = readJson(getPackageFile(packageName, 'package.json')).version
    let previousContent = getFileAtRef(getPackageFile(packageName, 'package.json'), 'HEAD~1')
    let previousVersion = previousContent ? JSON.parse(previousContent).version : null

    if (previousVersion !== null && currentVersion !== previousVersion) {
      versioned.push({
        packageName,
        version: currentVersion,
        tag: `${packageName}@${currentVersion}`,
      })
    }
  }

  return versioned
}

function main() {
  console.log(preview ? '🔍 PREVIEW MODE\n' : '')

  // Only proceed if this is a release commit (from version PR merge or manual pnpm changes:version)
  let commitMessage = getHeadCommitMessage()
  if (!commitMessage.startsWith('Release ')) {
    console.log('Not a release commit, skipping tag creation.')
    process.exit(0)
  }

  // Find packages with version changes
  console.log('Checking for version changes from parent commit...')
  let versioned = getVersionedPackages()

  if (versioned.length === 0) {
    console.log('No version changes detected.')
    process.exit(0)
  }

  console.log(
    `\nFound ${versioned.length} package${versioned.length === 1 ? '' : 's'} with version changes:`,
  )
  for (let pkg of versioned) {
    console.log(`  • ${pkg.packageName}: ${pkg.version}`)
  }
  console.log()

  if (preview) {
    console.log('Would create tags:')
    for (let pkg of versioned) {
      console.log(`  • ${pkg.tag}`)
    }
    console.log('\nPreview complete. No tags created.')
    process.exit(0)
  }

  // Configure git
  console.log('Configuring git...')
  logAndExec('git config user.name "Remix Run Bot"')
  logAndExec('git config user.email "hello@remix.run"')

  // Create tags locally
  console.log(`\nCreating tag${versioned.length === 1 ? '' : 's'}...`)
  for (let pkg of versioned) {
    cp.execSync(`git tag ${pkg.tag}`)
    console.log(`  ✓ ${pkg.tag}`)
  }

  // Push all tags
  console.log(`\nPushing tag${versioned.length === 1 ? '' : 's'}...`)
  logAndExec('git push --tags')

  console.log(
    `\n✅ Done. The publish workflow will be triggered for the new tag${versioned.length === 1 ? '' : 's'}.`,
  )
}

main()
