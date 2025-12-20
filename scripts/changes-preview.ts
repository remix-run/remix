import {
  validateAllChanges,
  formatValidationErrors,
  getAllReleases,
  generateChangelogContent,
  generateCommitMessage,
} from './utils/changes.ts'
import { colors, colorize } from './utils/color.ts'

/**
 * Main preview function
 */
function main() {
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

  console.log(colorize('CHANGES', colors.lightBlue))
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

  console.log(colorize('CHANGELOG PREVIEW', colors.lightBlue))
  console.log()

  let now = new Date()
  for (let release of releases) {
    console.log(colorize(`${release.packageName}/CHANGELOG.md:`, colors.gray))
    console.log()
    console.log(generateChangelogContent(release, now))
  }

  console.log(colorize('COMMIT MESSAGE', colors.lightBlue))
  console.log()
  console.log(generateCommitMessage(releases))
  console.log()

  console.log(colorize('GIT TAGS', colors.lightBlue))
  console.log()
  for (let release of releases) {
    console.log(`${release.packageName}@${release.nextVersion}`)
  }
  console.log()

  console.log(colorize('VERSION COMMAND', colors.lightBlue))
  console.log()
  console.log('pnpm changes:version')
  console.log()
}

main()
