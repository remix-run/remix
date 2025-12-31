import * as cp from 'node:child_process'

import { getPackageFile } from './utils/packages.js'
import { readJson, writeJson } from './utils/fs.js'
import { logAndExec } from './utils/process.js'

let skipCommit = process.argv.includes('--no-commit')

let packageName = 'remix'
let packageJsonPath = getPackageFile(packageName, 'package.json')
let packageJson = readJson(packageJsonPath)

let datestamp = new Date().toISOString().substring(0, 10).replace(/-/g, '')
let sha = cp.execSync('git rev-parse --short HEAD', { encoding: 'utf-8' })?.trim()
let nextVersion = `0.0.0-nightly-${datestamp}-${sha}`

console.log('═'.repeat(80))
console.log('📦 PREPARING RELEASE')
console.log('═'.repeat(80))
console.log()

console.log(`📦 ${packageName}: ${packageJson.version} → ${nextVersion}`)

// Update package.json
packageJson.version = nextVersion
writeJson(packageJsonPath, packageJson)
console.log(`  ✓ Updated package.json to ${nextVersion}`)

// Stage all changes
console.log('📋 Staging changes...')
logAndExec('git add .')
console.log()

if (skipCommit) {
  console.log('⚠️  Skipping commit as per --no-commit flag')
  logAndExec('git status')
} else {
  // Create commit
  console.log('💾 Creating commit...')
  logAndExec(`git commit -m "Remix nightly release: ${nextVersion}"`)
  console.log()

  // Create tags
  console.log('🏷️  Creating tags...')
  let tag = `${packageName}@${nextVersion}`
  logAndExec(`git tag ${tag}`)
  console.log(`  ✓ Created tag: ${tag}`)
  console.log()

  // Success message
  console.log('═'.repeat(80))
  console.log('✅ RELEASE PREPARED')
  console.log('═'.repeat(80))
  console.log()
  console.log('Release commit and tags have been created locally.')
  console.log()
  console.log('To push the release, run:')
  console.log()
  console.log('  git push && git push --tags')
  console.log()
}
