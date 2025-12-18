import * as cp from 'node:child_process'

import { createRelease } from './utils/github-releases.js'
import { isValidVersion } from './utils/semver.js'

let args = process.argv.slice(2)
let preview = args.includes('--preview')
let tag = args.find((arg) => !arg.startsWith('--'))

// If no tag provided, print usage and exit, or default to latest tag in preview mode
if (tag === undefined) {
  if (preview) {
    tag = cp.execSync('git tag --sort=-creatordate').toString().trim().split('\n')[0]
    console.log(`Using latest tag for preview: ${tag}`)
    console.log()
  } else {
    console.error('Usage:')
    console.error('  node create-github-release.js <tag> [--preview]')
    process.exit(1)
  }
}

// Parse and validate the tag
let [packageName, version] = tag.split('@')
if (!packageName || !version || !isValidVersion(version)) {
  console.error(`Invalid tag: "${tag}"`)
  process.exit(1)
}

// Verify we are on the right tag (skip for preview)
if (!preview) {
  let currentTags = cp.execSync('git tag --points-at HEAD').toString().trim().split('\n')
  if (!currentTags.includes(tag)) {
    console.error(`Tag "${tag}" does not point to HEAD`)
    process.exit(1)
  }
}

// Create the GitHub Release
if (!preview) {
  console.log(`Creating GitHub Release for ${tag} ...`)
  console.log()
}

let url = await createRelease(packageName, version, { preview })

if (!preview && url != null) {
  console.log(`Done, see ${url}`)
  console.log()
}
