/**
 * Creates tags and GitHub releases for packages that were versioned.
 * This script runs after `pnpm publish --recursive` in CI.
 *
 * Usage:
 *   node scripts/publish.ts [--preview]
 */
import * as cp from 'node:child_process'

import { getVersionedPackages } from './utils/packages.ts'
import { tagExists } from './utils/git.ts'
import { logAndExec } from './utils/process.ts'
import { createRelease } from './utils/github.ts'

let args = process.argv.slice(2)
let preview = args.includes('--preview')

async function main() {
  console.log(preview ? '🔍 PREVIEW MODE\n' : '')

  // Find packages with version changes
  console.log('Finding versioned packages...')
  let versioned = getVersionedPackages()

  if (versioned.length === 0) {
    console.log('No version changes detected.')
    return
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
      let exists = tagExists(pkg.tag)
      console.log(`  • ${pkg.tag}${exists ? ' (already exists)' : ''}`)
    }
    console.log('\nWould create GitHub releases:')
    for (let pkg of versioned) {
      console.log(`  • ${pkg.packageName} v${pkg.version}`)
    }
    console.log('\nPreview complete.')
    return
  }

  // Configure git
  console.log('Configuring git...')
  logAndExec('git config user.name "Remix Run Bot"')
  logAndExec('git config user.email "hello@remix.run"')

  // Create tags (skip if already exist)
  console.log(`\nCreating tag${versioned.length === 1 ? '' : 's'}...`)
  let tagsCreated = 0
  for (let pkg of versioned) {
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
  for (let pkg of versioned) {
    let url = await createRelease(pkg.packageName, pkg.version)
    if (url) {
      console.log(`  ✓ ${pkg.packageName} v${pkg.version}`)
    } else {
      console.log(`  ⊘ ${pkg.packageName} v${pkg.version} (already exists)`)
    }
  }

  console.log('\n✅ Done.')
}

main()
