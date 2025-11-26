import {
  validateAllChanges,
  formatValidationErrors,
  getAllReleases,
  generateChangelogContent,
  generateCommitMessage,
} from './utils/changes.js'

/**
 * Main preview function
 */
function main() {
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

  console.log('📦 CHANGES')
  console.log()
  console.log(`${releases.length} package${releases.length === 1 ? '' : 's'} with changes:\n`)

  for (let release of releases) {
    console.log(
      `  • ${release.packageName}: ${release.currentVersion} → ${release.nextVersion} (${release.bump} bump)`,
    )
    for (let change of release.changes) {
      console.log(`    - ${change.file}`)
    }
    console.log()
  }

  console.log('📝 CHANGELOG PREVIEW')
  console.log()

  let now = new Date()
  for (let release of releases) {
    console.log(`${release.packageName}/CHANGELOG.md:`)
    console.log()
    console.log(generateChangelogContent(release, now))
  }

  console.log('💾 COMMIT MESSAGE')
  console.log()
  console.log(generateCommitMessage(releases))
  console.log()

  console.log('🏷️  GIT TAGS')
  console.log()
  for (let release of releases) {
    console.log(`${release.packageName}@${release.nextVersion}`)
  }
  console.log()

  console.log('🚀 VERSION COMMAND')
  console.log()
  console.log('pnpm changes:version')
  console.log()
}

main()
