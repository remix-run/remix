import * as fs from 'node:fs'
import * as path from 'node:path'
import { getAllPackageNames, getPackageDir, getPackageFile } from './packages.js'
import { readJson } from './fs.js'
import { getNextVersion } from './semver.js'

/**
 * @typedef {{
 *   package: string
 *   file: string
 *   error: string
 * }} ValidationError
 */

/**
 * Valid change file name pattern: (major|minor|patch).description.md
 * @type {RegExp}
 */
const CHANGE_FILE_PATTERN = /^(major|minor|patch)\..+\.md$/

/**
 * @typedef {{
 *   errorCount: number
 *   errorsByPackage: Record<string, ValidationError[]>
 * }} ValidationResult
 */

/**
 * Formats validation errors for display
 * @param {ValidationResult} validationResult
 * @returns {string} Formatted error message
 */
export function formatValidationErrors(validationResult) {
  let lines = []

  for (let [packageName, packageErrors] of Object.entries(validationResult.errorsByPackage)) {
    lines.push(`📦 ${packageName}:`)
    for (let error of packageErrors) {
      lines.push(`   ${error.file}: ${error.error}`)
    }
    lines.push('')
  }

  let packageCount = Object.keys(validationResult.errorsByPackage).length
  lines.push(
    `Found ${validationResult.errorCount} error${validationResult.errorCount === 1 ? '' : 's'} in ${packageCount} package${packageCount === 1 ? '' : 's'}`,
  )

  return lines.join('\n')
}

/**
 * Validates all change files across all packages
 * @returns {ValidationResult} Validation result with error count and errors grouped by package
 */
export function validateAllChanges() {
  let packageNames = getAllPackageNames()
  /** @type {Record<string, ValidationError[]>} */
  let errorsByPackage = {}
  let errorCount = 0

  for (let packageName of packageNames) {
    let packageErrors = validatePackageChanges(packageName)
    if (packageErrors.length > 0) {
      errorsByPackage[packageName] = packageErrors
      errorCount += packageErrors.length
    }
  }

  return { errorCount, errorsByPackage }
}

/**
 * Validates change files for a single package
 * @param {string} packageName
 * @returns {ValidationError[]}
 */
export function validatePackageChanges(packageName) {
  let packageDir = getPackageDir(packageName)
  let changesDir = path.join(packageDir, '.changes')
  let errors = []

  // Changes directory should exist (with at least README.md)
  if (!fs.existsSync(changesDir)) {
    errors.push({
      package: packageName,
      file: '.changes/',
      error: 'Changes directory does not exist',
    })
    return errors
  }

  // README.md should exist in .changes directory so it persists between releases
  let readmePath = path.join(changesDir, 'README.md')
  if (!fs.existsSync(readmePath)) {
    errors.push({
      package: packageName,
      file: '.changes/README.md',
      error: 'README.md is missing from .changes directory',
    })
  }

  // Read all files in .changes directory
  let files = fs.readdirSync(changesDir)

  // Filter out README.md and validate the rest
  let changeFiles = files.filter((file) => file !== 'README.md')

  for (let file of changeFiles) {
    // Check if it's a markdown file
    if (!file.endsWith('.md')) {
      errors.push({
        package: packageName,
        file,
        error: 'Change files must have .md extension',
      })
      continue
    }

    // Check if it matches the required pattern
    if (!CHANGE_FILE_PATTERN.test(file)) {
      errors.push({
        package: packageName,
        file,
        error:
          'Change file name must start with "major.", "minor.", or "patch." (e.g. "minor.add-feature.md")',
      })
      continue
    }

    // Check if file is not empty
    let filePath = path.join(changesDir, file)
    let content = fs.readFileSync(filePath, 'utf-8').trim()

    if (content.length === 0) {
      errors.push({
        package: packageName,
        file,
        error: 'Change file cannot be empty',
      })
      continue
    }

    // Check if first line starts with a bullet point
    let firstLine = content.split('\n')[0].trim()
    if (firstLine.startsWith('- ') || firstLine.startsWith('* ')) {
      errors.push({
        package: packageName,
        file,
        error:
          'Change file should not start with a bullet point (- or *). The bullet will be added automatically in the CHANGELOG. Just write the text directly.',
      })
      continue
    }
  }

  return errors
}

/**
 * Gets all change files for a package
 * @param {string} packageName
 * @returns {{ file: string; bump: 'major' | 'minor' | 'patch'; content: string }[]}
 */
export function getPackageChangeFiles(packageName) {
  let packageDir = getPackageDir(packageName)
  let changesDir = path.join(packageDir, '.changes')

  if (!fs.existsSync(changesDir)) {
    return []
  }

  let files = fs.readdirSync(changesDir)
  let changeFiles = files.filter((file) => file !== 'README.md' && file.endsWith('.md'))

  return changeFiles
    .filter((file) => CHANGE_FILE_PATTERN.test(file))
    .map((file) => {
      let filePath = path.join(changesDir, file)
      let content = fs.readFileSync(filePath, 'utf-8').trim()
      let bump = /** @type {'major' | 'minor' | 'patch'} */ (file.split('.')[0])

      return {
        file,
        bump,
        content,
      }
    })
}

/**
 * Gets all packages that have change files
 * @returns {string[]}
 */
export function getPackagesWithChanges() {
  let packageNames = getAllPackageNames()
  return packageNames.filter((packageName) => {
    let changeFiles = getPackageChangeFiles(packageName)
    return changeFiles.length > 0
  })
}

/**
 * @typedef {{
 *   packageName: string
 *   currentVersion: string
 *   nextVersion: string
 *   bump: 'major' | 'minor' | 'patch'
 *   changes: Array<{ file: string; content: string }>
 * }} PackageRelease
 */

/**
 * Determines the highest severity bump type
 * @param {Array<'major' | 'minor' | 'patch'>} bumps
 * @returns {'major' | 'minor' | 'patch'}
 */
export function getHighestBump(bumps) {
  if (bumps.includes('major')) return 'major'
  if (bumps.includes('minor')) return 'minor'
  return 'patch'
}

/**
 * Checks if content starts with "BREAKING CHANGE: " (case-insensitive,
 * ignoring markdown formatting and leading whitespace)
 * @param {string} content
 * @returns {boolean}
 */
function hasBreakingChangePrefix(content) {
  return content
    .trimStart()
    .replace(/^[*_]+/, '')
    .toLowerCase()
    .startsWith('breaking change: ')
}

/**
 * Formats a changelog entry from change file content
 * @param {string} content
 * @returns {string}
 */
export function formatChangelogEntry(content) {
  let lines = content.trim().split('\n')

  if (lines.length === 1) {
    return `- ${lines[0]}`
  }

  // Multi-line: first line is bullet, rest are indented
  let [firstLine, ...restLines] = lines
  let formatted = [`- ${firstLine}`]

  for (let line of restLines) {
    // Add proper indentation for continuation lines
    formatted.push(line ? `  ${line}` : '')
  }

  return formatted.join('\n')
}

/**
 * Generates changelog content for a package release
 * @param {PackageRelease} release
 * @param {Date} date
 * @returns {string}
 */
export function generateChangelogContent(release, date) {
  let dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD
  let lines = []

  lines.push(`## v${release.nextVersion} (${dateStr})`)
  lines.push('')

  // Sort changes alphabetically by filename, with breaking changes hoisted to the top
  let sortedChanges = [...release.changes].sort((a, b) => {
    let aBreaking = hasBreakingChangePrefix(a.content)
    let bBreaking = hasBreakingChangePrefix(b.content)
    if (aBreaking !== bBreaking) return aBreaking ? -1 : 1
    return a.file.localeCompare(b.file)
  })

  for (let change of sortedChanges) {
    lines.push(formatChangelogEntry(change.content))
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Gets all releases that would be prepared
 * @returns {PackageRelease[]}
 */
export function getAllReleases() {
  let packageNames = getPackagesWithChanges()
  let releases = []

  for (let packageName of packageNames) {
    let packageJsonPath = getPackageFile(packageName, 'package.json')
    let packageJson = readJson(packageJsonPath)
    let currentVersion = packageJson.version

    let changeFiles = getPackageChangeFiles(packageName)
    let bumps = changeFiles.map((cf) => cf.bump)
    let bump = getHighestBump(bumps)
    let nextVersion = getNextVersion(currentVersion, bump)

    releases.push({
      packageName,
      currentVersion,
      nextVersion,
      bump,
      changes: changeFiles.map((cf) => ({
        file: cf.file,
        content: cf.content,
      })),
    })
  }

  return releases
}

/**
 * Generates the commit message for all releases
 * @param {PackageRelease[]} releases
 * @returns {string}
 */
export function generateCommitMessage(releases) {
  // Subject line
  let subject =
    releases.length === 1
      ? `Release ${releases[0].packageName}@${releases[0].nextVersion}`
      : `Release ${releases.map((r) => `${r.packageName}@${r.nextVersion}`).join(', ')}`

  // Body with version changes
  let body = releases
    .map((r) => `- ${r.packageName}: ${r.currentVersion} -> ${r.nextVersion}`)
    .join('\n')

  return `${subject}\n\n${body}`
}
