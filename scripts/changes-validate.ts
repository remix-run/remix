import * as fs from 'node:fs'
import { parseAllChangeFiles, formatValidationErrors } from './utils/changes.ts'
import { colors, colorize } from './utils/color.ts'
import { getAllPackageDirNames, getPackageFile } from './utils/packages.ts'

function getMissingChangelogPackageDirNames(): string[] {
  let packageDirNames = getAllPackageDirNames()
  let missing: string[] = []

  for (let packageDirName of packageDirNames) {
    let changelogPath = getPackageFile(packageDirName, 'CHANGELOG.md')
    if (!fs.existsSync(changelogPath)) {
      missing.push(packageDirName)
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
  let missingChangelogPackageDirNames = getMissingChangelogPackageDirNames()

  if (missingChangelogPackageDirNames.length > 0) {
    hasErrors = true
    console.error(colorize('Missing changelogs', colors.red) + '\n')
    for (let packageDirName of missingChangelogPackageDirNames) {
      console.error(`📦 ${packageDirName}: Missing CHANGELOG.md file`)
    }
    console.error()
  }

  // Validate change files
  console.log('Validating change files...\n')
  // Always validate remix even if it's set to include:false
  let result = parseAllChangeFiles(true)

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
