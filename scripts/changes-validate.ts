import * as fs from 'node:fs'
import { parseAllChangeFiles, formatValidationErrors } from './utils/changes.ts'
import { colors, colorize } from './utils/color.ts'
import { getAllPackageNames, getPackageFile } from './utils/packages.ts'

function detectPackagesWithMissingChangelogs(): string[] {
  let packageNames = getAllPackageNames()
  let missing: string[] = []

  for (let packageName of packageNames) {
    let changelogPath = getPackageFile(packageName, 'CHANGELOG.md')
    if (!fs.existsSync(changelogPath)) {
      missing.push(packageName)
    }
  }

  return missing
}

/**
 * Validates all change files in the repository
 * Exits with code 1 if any validation errors are found
 */
function main() {
  let hasErrors = false

  // Validate all packages have changelogs
  console.log('Validating package changelogs...\n')
  let packagesWithMissingChangelogs = detectPackagesWithMissingChangelogs()

  if (packagesWithMissingChangelogs.length > 0) {
    hasErrors = true
    console.error(colorize('Missing changelogs', colors.red) + '\n')
    for (let packageName of packagesWithMissingChangelogs) {
      console.error(`📦 ${packageName}: Missing CHANGELOG.md file`)
    }
    console.error()
  }

  // Validate change files
  console.log('Validating change files...\n')
  let result = parseAllChangeFiles()

  if (!result.valid) {
    hasErrors = true
    console.error(colorize('Invalid change files', colors.red) + '\n')
    console.error(formatValidationErrors(result.errors))
    console.error()
  } else {
    console.log(colorize('All change files are valid!', colors.lightGreen) + '\n')
  }

  if (hasErrors) {
    process.exit(1)
  }
}

main()
