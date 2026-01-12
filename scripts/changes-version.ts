/**
 * Updates package.json versions, CHANGELOG.md files, and creates a release commit.
 *
 * Usage:
 *   pnpm changes:version [--no-commit]
 *
 * Options:
 *   --no-commit  Only update files, don't commit (for manual review)
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  validateAllChanges,
  formatValidationErrors,
  getAllReleases,
  generateChangelogContent,
  generateCommitMessage,
} from './utils/changes.ts'
import { colors, colorize } from './utils/color.ts'
import { getPackageFile, getPackageDir } from './utils/packages.ts'
import { readJson, writeJson, readFile, writeFile } from './utils/fs.ts'
import { logAndExec } from './utils/process.ts'

/**
 * Updates package.json version
 */
function updatePackageJson(packageName: string, newVersion: string) {
  let packageJsonPath = getPackageFile(packageName, 'package.json')
  let packageJson = readJson(packageJsonPath)
  packageJson.version = newVersion
  writeJson(packageJsonPath, packageJson)
  console.log(`  ✓ Updated package.json to ${newVersion}`)
}

/**
 * Updates CHANGELOG.md with new content
 */
function updateChangelog(packageName: string, newContent: string) {
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
 */
function deleteChangeFiles(packageName: string) {
  let changesDir = path.join(getPackageDir(packageName), '.changes')
  let files = fs.readdirSync(changesDir)
  let changeFiles = files.filter((file) => file !== 'README.md' && file.endsWith('.md'))

  for (let file of changeFiles) {
    let filePath = path.join(changesDir, file)
    fs.unlinkSync(filePath)
  }

  console.log(`  ✓ Deleted ${changeFiles.length} change file${changeFiles.length === 1 ? '' : 's'}`)
}

/**
 * Main version function
 */
function main() {
  let skipCommit = process.argv.includes('--no-commit')

  console.log('Validating change files...\n')

  let validationResult = validateAllChanges()
  if (validationResult.errorCount > 0) {
    console.error(colorize('Validation failed', colors.red) + '\n')
    console.error(formatValidationErrors(validationResult))
    console.error()
    process.exit(1)
  }

  let releases = getAllReleases()
  if (releases.length === 0) {
    console.log('No packages have changes to release.\n')
    process.exit(0)
  }

  console.log(colorize('Validation passed!', colors.lightGreen) + '\n')
  console.log('═'.repeat(80))
  console.log(colorize(skipCommit ? 'UPDATING VERSION' : 'PREPARING RELEASE', colors.lightBlue))
  console.log('═'.repeat(80))
  console.log()

  let now = new Date()

  // Process each package
  for (let release of releases) {
    console.log(
      colorize(`${release.packageName}:`, colors.gray) +
        ` ${release.currentVersion} → ${release.nextVersion}`,
    )

    // Update package.json
    updatePackageJson(release.packageName, release.nextVersion)

    // Update CHANGELOG.md
    let changelogContent = generateChangelogContent(release, { date: now })
    updateChangelog(release.packageName, changelogContent)

    // Delete change files
    deleteChangeFiles(release.packageName)

    console.log()
  }

  if (skipCommit) {
    // Success message for --no-commit
    console.log('═'.repeat(80))
    console.log(colorize('VERSION UPDATED', colors.lightGreen))
    console.log('═'.repeat(80))
    console.log()
    console.log('Files have been updated. Review the changes, then manually commit:')
    console.log()
    console.log('```sh')
    let commitMessage = generateCommitMessage(releases)
    console.log(`git add .`)
    console.log()
    console.log(`git commit -m "${commitMessage}"`)
    console.log('```')
    console.log()
  } else {
    // Stage all changes
    console.log('Staging changes...')
    logAndExec('git add .')
    console.log()

    // Create commit
    let commitMessage = generateCommitMessage(releases)
    console.log('Creating commit...')
    logAndExec(`git commit -m "${commitMessage}"`)
    console.log()

    // Success message (skip in CI since the workflow handles the rest)
    if (!process.env.CI) {
      console.log('═'.repeat(80))
      console.log('✅ RELEASE PREPARED')
      console.log('═'.repeat(80))
      console.log()
      console.log('Release commit has been created locally.')
      console.log()
      console.log('To publish, push and the publish workflow will handle the rest:')
      console.log()
      console.log('  git push')
      console.log()
    }
  }
}

main()
