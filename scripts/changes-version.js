import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  validateAllChanges,
  formatValidationErrors,
  getAllReleases,
  generateChangelogContent,
  generateCommitMessage,
} from './utils/changes.js'
import { getPackageFile, getPackageDir } from './utils/packages.js'
import { readJson, writeJson, readFile, writeFile } from './utils/fs.js'
import { logAndExec } from './utils/process.js'

/**
 * Updates package.json version
 * @param {string} packageName
 * @param {string} newVersion
 */
function updatePackageJson(packageName, newVersion) {
  let packageJsonPath = getPackageFile(packageName, 'package.json')
  let packageJson = readJson(packageJsonPath)
  packageJson.version = newVersion
  writeJson(packageJsonPath, packageJson)
  console.log(`  ✓ Updated package.json to ${newVersion}`)
}

/**
 * Updates CHANGELOG.md with new content
 * @param {string} packageName
 * @param {string} newContent
 */
function updateChangelog(packageName, newContent) {
  let changelogPath = getPackageFile(packageName, 'CHANGELOG.md')
  let existingChangelog = readFile(changelogPath)

  // Find where to insert (after the heading and intro, before first ## version)
  let lines = existingChangelog.split('\n')
  let insertIndex = 0

  // Skip past the initial # heading and introductory text
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      insertIndex = i
      break
    }
  }

  // Insert new content
  lines.splice(insertIndex, 0, newContent)
  writeFile(changelogPath, lines.join('\n'))
  console.log(`  ✓ Updated CHANGELOG.md`)
}

/**
 * Deletes all change files (except README.md)
 * @param {string} packageName
 */
function deleteChangeFiles(packageName) {
  let changesDir = path.join(getPackageDir(packageName), '.changes')
  let files = fs.readdirSync(changesDir)
  let changeFiles = files.filter((file) => file !== 'README.md' && file.endsWith('.md'))

  for (let file of changeFiles) {
    let filePath = path.join(changesDir, file)
    fs.unlinkSync(filePath)
  }

  console.log(`  ✓ Deleted ${changeFiles.length} change file(s)`)
}

/**
 * Main version function
 */
function main() {
  let skipCommit = process.argv.includes('--no-commit')

  console.log('🔍 Validating change files...\n')

  let validationResult = validateAllChanges()
  if (validationResult.errorCount > 0) {
    console.error('❌ Validation failed\n')
    console.error(formatValidationErrors(validationResult))
    console.error()
    process.exit(1)
  }

  let releases = getAllReleases()
  if (releases.length === 0) {
    console.log('📭 No packages have changes to release.\n')
    process.exit(0)
  }

  console.log('✅ Validation passed!\n')
  console.log('═'.repeat(80))
  console.log(skipCommit ? '📦 UPDATING VERSION' : '📦 PREPARING RELEASE')
  console.log('═'.repeat(80))
  console.log()

  let now = new Date()

  // Process each package
  for (let release of releases) {
    console.log(`📦 ${release.packageName}: ${release.currentVersion} → ${release.nextVersion}`)

    // Update package.json
    updatePackageJson(release.packageName, release.nextVersion)

    // Update CHANGELOG.md
    let changelogContent = generateChangelogContent(release, now)
    updateChangelog(release.packageName, changelogContent)

    // Delete change files
    deleteChangeFiles(release.packageName)

    console.log()
  }

  if (skipCommit) {
    // Success message for --no-commit
    console.log('═'.repeat(80))
    console.log('✅ VERSION UPDATED')
    console.log('═'.repeat(80))
    console.log()
    console.log('Files have been updated. Review the changes, then manually commit and tag:')
    console.log()
    let commitMessage = generateCommitMessage(releases)
    console.log(`  git add .`)
    console.log(`  git commit -m "${commitMessage.split('\n').join('\\n')}"`)
    for (let release of releases) {
      let tag = `${release.packageName}@${release.nextVersion}`
      console.log(`  git tag ${tag}`)
    }
    console.log()
  } else {
    // Stage all changes
    console.log('📋 Staging changes...')
    logAndExec('git add .')
    console.log()

    // Create commit
    let commitMessage = generateCommitMessage(releases)
    console.log('💾 Creating commit...')
    logAndExec(`git commit -m "${commitMessage.split('\n').join('\\n')}"`)
    console.log()

    // Create tags
    console.log('🏷️  Creating tags...')
    for (let release of releases) {
      let tag = `${release.packageName}@${release.nextVersion}`
      logAndExec(`git tag ${tag}`)
      console.log(`  ✓ Created tag: ${tag}`)
    }
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
}

main()
