import * as fs from 'node:fs'
import * as path from 'node:path'
import * as semver from 'semver'
import {
  getAllPackageDirNames,
  getPackageFile,
  getPackagePath,
  packageNameToDirectoryName,
} from './packages.ts'
import { fileExists, readFile, readJson } from './fs.ts'

const bumpTypes = ['major', 'minor', 'patch'] as const
type BumpType = (typeof bumpTypes)[number]

const changesDirName = '.changes'
const configFileName = 'config.json'
const configFilePath = path.join(changesDirName, configFileName)

// Release configuration (from packages/remix/.changes/config.json)
// Only the remix package supports prerelease mode and skipped releases
export interface RemixReleaseConfig {
  channel: string
  include: boolean
}

export type ParsedRemixReleaseConfig =
  | { exists: false }
  | { exists: true; valid: true; config: RemixReleaseConfig }
  | { exists: true; valid: false; error: string }

/**
 * Reads and validates the remix package's config.json.
 * Only remix supports prerelease mode - other packages publish as "latest".
 * Only remix supports skipped releases
 */
export function readRemixReleaseConfig(): ParsedRemixReleaseConfig {
  let remixPackagePath = getPackagePath('remix')
  let releaseJsonPath = path.join(remixPackagePath, configFilePath)

  if (!fs.existsSync(releaseJsonPath)) {
    return { exists: false }
  }

  let content: unknown
  try {
    content = JSON.parse(fs.readFileSync(releaseJsonPath, 'utf-8'))
  } catch {
    return { exists: true, valid: false, error: `Invalid JSON in ${configFileName}` }
  }

  if (typeof content !== 'object' || content === null) {
    return {
      exists: true,
      valid: false,
      error: `${configFileName} must be an object with a "channel" field`,
    }
  }

  let obj = content as Record<string, unknown>

  if (!('channel' in obj)) {
    return { exists: true, valid: false, error: `${configFileName} must have a "channel" field` }
  }

  if (typeof obj.channel !== 'string' || obj.channel.trim().length === 0) {
    return {
      exists: true,
      valid: false,
      error: `${configFileName} "channel" must be a non-empty string`,
    }
  }

  if (typeof obj.include !== 'boolean') {
    return {
      exists: true,
      valid: false,
      error: `${configFileName} "include" must be a boolean`,
    }
  }

  return {
    exists: true,
    valid: true,
    config: {
      channel: obj.channel.trim(),
      include: obj.include,
    },
  }
}

/**
 * Extracts the prerelease identifier from a version string (e.g., "alpha" from "3.0.0-alpha.5")
 */
function getPrereleaseIdentifier(version: string): string | null {
  let prerelease = semver.prerelease(version)
  if (prerelease === null || prerelease.length === 0) {
    return null
  }
  return typeof prerelease[0] === 'string' ? prerelease[0] : null
}

/**
 * Calculates the next version based on current version, bump type, and release config.
 */
function getNextVersion(
  currentVersion: string,
  bumpType: BumpType,
  releaseConfig: RemixReleaseConfig | null,
): string {
  let currentPrereleaseId = getPrereleaseIdentifier(currentVersion)
  let isCurrentPrerelease = currentPrereleaseId !== null

  if (releaseConfig !== null) {
    // In prerelease mode
    let targetChannel = releaseConfig.channel

    if (currentPrereleaseId === targetChannel) {
      // Same channel - just bump the counter
      let nextVersion = semver.inc(currentVersion, 'prerelease', targetChannel)
      if (nextVersion == null) {
        throw new Error(`Invalid prerelease increment: ${currentVersion}`)
      }
      return nextVersion
    } else {
      // Entering prerelease or transitioning to a new channel (e.g., stable → alpha, or alpha → beta)
      // Apply the bump type to get the base version, then add prerelease suffix
      let baseVersion = isCurrentPrerelease
        ? currentVersion.replace(/-.*$/, '') // Strip existing prerelease suffix
        : semver.inc(currentVersion, bumpType as semver.ReleaseType)

      if (baseVersion == null) {
        throw new Error(`Invalid version increment: ${currentVersion} + ${bumpType}`)
      }

      return `${baseVersion}-${targetChannel}.0`
    }
  } else {
    // Not in prerelease mode
    if (isCurrentPrerelease) {
      // Graduating from prerelease to stable - strip the prerelease suffix
      let baseVersion = currentVersion.replace(/-.*$/, '')
      return baseVersion
    } else {
      // Normal stable release
      let nextVersion = semver.inc(currentVersion, bumpType as semver.ReleaseType)
      if (nextVersion == null) {
        throw new Error(`Invalid version increment: ${currentVersion} + ${bumpType}`)
      }
      return nextVersion
    }
  }
}

interface ChangeFile {
  file: string
  bump: BumpType
  content: string
}

interface ValidationError {
  packageDirName: string
  file: string
  error: string
}

type ParsedPackageChanges =
  | { valid: true; changes: ChangeFile[]; releaseConfig: RemixReleaseConfig | null }
  | { valid: false; errors: ValidationError[] }

/**
 * Parses and validates all change files for a package.
 * Returns changes if valid, or errors if invalid.
 */
function parsePackageChanges(packageDirName: string): ParsedPackageChanges {
  let packagePath = getPackagePath(packageDirName)
  let changesDir = path.join(packagePath, '.changes')
  let changes: ChangeFile[] = []
  let errors: ValidationError[] = []

  // Changes directory should exist (with at least README.md)
  if (!fs.existsSync(changesDir)) {
    return {
      valid: false,
      errors: [
        {
          packageDirName,
          file: `${changesDirName}/`,
          error: 'Changes directory does not exist',
        },
      ],
    }
  }

  // README.md should exist in .changes directory so it persists between releases
  let readmePath = path.join(changesDir, 'README.md')
  if (!fs.existsSync(readmePath)) {
    errors.push({
      packageDirName,
      file: `${changesDirName}/README.md`,
      error: `${changesDirName}/README.md is missing`,
    })
  }

  // Get package version to determine validation rules
  let packageJsonPath = getPackageFile(packageDirName, 'package.json')
  let packageJson = readJson(packageJsonPath)
  let currentVersion = packageJson.version as string
  let majorVersion = semver.major(currentVersion)
  let isV1Plus = majorVersion >= 1
  let currentVersionPrereleaseId = getPrereleaseIdentifier(currentVersion)
  let isCurrentVersionPrerelease = currentVersionPrereleaseId !== null

  // Handle config.json - only supported for remix package
  let releaseConfig: RemixReleaseConfig | null = null

  if (packageDirName === 'remix') {
    // For remix, read and validate the release config
    let parsedRemixReleaseConfig = readRemixReleaseConfig()
    if (parsedRemixReleaseConfig.exists) {
      if (!parsedRemixReleaseConfig.valid) {
        errors.push({
          packageDirName,
          file: configFilePath,
          error: parsedRemixReleaseConfig.error,
        })
        return { valid: false, errors }
      }
      releaseConfig = parsedRemixReleaseConfig.config
    }
  } else {
    // For non-remix packages, error if config.json exists
    if (fs.existsSync(configFilePath)) {
      errors.push({
        packageDirName,
        file: configFilePath,
        error: `${configFileName} is only supported for the "remix" package. Remove this file.`,
      })
      return { valid: false, errors }
    }
  }

  // Read all files in .changes directory
  let files = fs.readdirSync(changesDir)
  let changeFileNames = files.filter((file) => file !== 'README.md' && file !== configFileName)
  let hasChangeFiles = changeFileNames.filter((f) => f.endsWith('.md')).length > 0

  // Validate config.json / version consistency
  if (releaseConfig !== null) {
    // Config exists
    if (
      currentVersionPrereleaseId !== null &&
      currentVersionPrereleaseId !== releaseConfig.channel
    ) {
      // Channel mismatch (e.g., version is alpha but config says beta) - need change files to transition
      if (!hasChangeFiles) {
        errors.push({
          packageDirName,
          file: configFilePath,
          error:
            `${configFileName} channel '${releaseConfig.channel}' doesn't match version's ` +
            `prerelease identifier '${currentVersionPrereleaseId}'. Add a change file to ` +
            `transition to ${releaseConfig.channel}.`,
        })
      }
    } else if (!isCurrentVersionPrerelease && !hasChangeFiles) {
      // Config says prerelease but version is stable AND no change files - need change files to enter prerelease
      errors.push({
        packageDirName,
        file: configFilePath,
        error:
          `${configFileName} exists but version ${currentVersion} is stable. Add a change ` +
          `file to enter prerelease mode, or delete ${configFileName} if this package should ` +
          `not be in prerelease.`,
      })
    }
  } else {
    // No config - validate version is stable (unless graduating with change files)
    if (isCurrentVersionPrerelease && !hasChangeFiles) {
      errors.push({
        packageDirName,
        file: `${changesDirName}/`,
        error:
          `Version ${currentVersion} is a prerelease but no ${configFileName} exists. ` +
          `Either add ${configFileName} with { "channel": "${currentVersionPrereleaseId}" }, or ` +
          `add a change file to graduate to stable.`,
      })
    }
  }

  for (let file of changeFileNames) {
    // Skip non-.md files
    if (!file.endsWith('.md')) {
      continue
    }

    // Parse and validate filename format (e.g. "minor.add-feature.md")
    let bump: BumpType | null = null

    let withoutExt = file.slice(0, -3)
    let dotIndex = withoutExt.indexOf('.')
    if (dotIndex !== -1) {
      let bumpStr = withoutExt.slice(0, dotIndex)
      let name = withoutExt.slice(dotIndex + 1)
      if (bumpTypes.includes(bumpStr as BumpType) && name.length > 0) {
        bump = bumpStr as BumpType
      }
    }

    if (bump == null) {
      errors.push({
        packageDirName,
        file,
        error:
          'Change file must be a ".md" file starting with "major.", "minor.", or "patch." ' +
          '(e.g. "minor.add-feature.md")',
      })
      continue
    }

    // Read file content
    let filePath = path.join(changesDir, file)
    let content = fs.readFileSync(filePath, 'utf-8').trim()

    // Check if file is not empty
    if (content.length === 0) {
      errors.push({
        packageDirName,
        file,
        error: 'Change file cannot be empty',
      })
      continue
    }

    // Check if first line starts with a bullet point
    let firstLine = content.split('\n')[0].trim()
    if (firstLine.startsWith('- ') || firstLine.startsWith('* ')) {
      errors.push({
        packageDirName,
        file,
        error:
          'Change file should not start with a bullet point (- or *). The bullet will be added ' +
          'automatically in the CHANGELOG. Just write the text directly.',
      })
      continue
    }

    // Check for headings that aren't level 4, 5, or 6
    let invalidHeadingMatch = content.match(/^(#{1,3}|#{7,})\s+/m)
    if (invalidHeadingMatch) {
      let headingLevel = invalidHeadingMatch[1].length
      errors.push({
        packageDirName,
        file,
        error:
          `Headings in change files must be level 4 (####), 5 (#####), or 6 (######), but ` +
          `found level ${headingLevel}. This is because change files are nested within the ` +
          `changelog which already uses heading levels 1-3.`,
      })
      continue
    }

    // Validate breaking change prefix matches the correct bump type (only for stable releases)
    // In prerelease mode, breaking changes don't need special handling since we're just bumping counter
    if (releaseConfig === null) {
      let isBreakingChange = hasBreakingChangePrefix(content)

      if (isBreakingChange) {
        if (isV1Plus && bump !== 'major') {
          errors.push({
            packageDirName,
            file,
            error:
              `Breaking changes in v1+ packages must use "major." prefix (current version: ` +
              `${currentVersion}). Rename to "major.${file.slice(file.indexOf('.') + 1)}"`,
          })
          continue
        } else if (!isV1Plus && !isCurrentVersionPrerelease && bump !== 'minor') {
          errors.push({
            packageDirName,
            file,
            error:
              `Breaking changes in v0.x packages must use "minor." prefix (current version: ` +
              `${currentVersion}). Rename to "minor.${file.slice(file.indexOf('.') + 1)}"`,
          })
          continue
        }
      }
    }

    // File is valid, add to changes
    changes.push({ file, bump, content })
  }

  // Validate entering prerelease requires a major bump
  if (releaseConfig !== null && !isCurrentVersionPrerelease && changes.length > 0) {
    let hasMajorBump = changes.some((c) => c.bump === 'major')
    if (!hasMajorBump) {
      errors.push({
        packageDirName,
        file: configFilePath,
        error:
          'Entering prerelease mode requires a major version bump. Add a change file with ' +
          '"major." prefix (e.g. "major.release-v2-alpha.md").',
      })
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return { valid: true, changes, releaseConfig }
}

export interface PackageRelease {
  packageDirName: string
  packageName: string
  currentVersion: string
  nextVersion: string
  bump: BumpType
  changes: ChangeFile[]
}

type ParsedChanges =
  | { valid: true; releases: PackageRelease[] }
  | { valid: false; errors: ValidationError[] }

/**
 * Parses and validates all change files across all packages.
 * Returns releases if valid, or errors if invalid.
 */
export function parseAllChangeFiles(): ParsedChanges {
  let packageDirNames = getAllPackageDirNames()
  let releases: PackageRelease[] = []
  let errors: ValidationError[] = []

  for (let packageDirName of packageDirNames) {
    let parsed = parsePackageChanges(packageDirName)

    if (!parsed.valid) {
      errors.push(...parsed.errors)
      continue
    }

    // Only create a release if there are changes
    if (parsed.changes.length > 0) {
      let packageJsonPath = getPackageFile(packageDirName, 'package.json')
      let packageJson = readJson(packageJsonPath)
      let packageName = packageJson.name as string
      let currentVersion = packageJson.version as string

      let bump = getHighestBump(parsed.changes.map((c) => c.bump))
      if (bump == null) continue

      let nextVersion = getNextVersion(currentVersion, bump, parsed.releaseConfig)

      releases.push({
        packageDirName,
        packageName,
        currentVersion,
        nextVersion,
        bump,
        changes: parsed.changes,
      })
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return { valid: true, releases }
}

/**
 * Formats validation errors for display
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  let errorsByPackageDirName: Record<string, ValidationError[]> = {}
  for (let error of errors) {
    if (!errorsByPackageDirName[error.packageDirName]) {
      errorsByPackageDirName[error.packageDirName] = []
    }
    errorsByPackageDirName[error.packageDirName].push(error)
  }

  let lines: string[] = []

  for (let [packageDirName, packageErrors] of Object.entries(errorsByPackageDirName)) {
    lines.push(`📦 ${packageDirName}:`)
    for (let error of packageErrors) {
      lines.push(`   ${error.file}: ${error.error}`)
    }
    lines.push('')
  }

  let packageCount = Object.keys(errorsByPackageDirName).length
  lines.push(
    `Found ${errors.length} error${errors.length === 1 ? '' : 's'} in ` +
      `${packageCount} package${packageCount === 1 ? '' : 's'}`,
  )

  return lines.join('\n')
}

/**
 * Determines the highest severity bump type from an array of bump types.
 */
function getHighestBump(bumps: BumpType[]): BumpType | null {
  if (bumps.includes('major')) return 'major'
  if (bumps.includes('minor')) return 'minor'
  if (bumps.includes('patch')) return 'patch'
  return null
}

/**
 * Checks if content starts with "BREAKING CHANGE: " (case-insensitive,
 * ignoring markdown formatting and leading whitespace)
 */
function hasBreakingChangePrefix(content: string): boolean {
  return content
    .trimStart()
    .replace(/^[*_]+/, '')
    .toLowerCase()
    .startsWith('breaking change: ')
}

/**
 * Formats a changelog entry from change file content
 */
function formatChangelogEntry(content: string): string {
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
 * Generates a section for a specific bump type (e.g., "### Major Changes")
 */
const sectionTitles: Record<BumpType, string> = {
  major: 'Major Changes',
  minor: 'Minor Changes',
  patch: 'Patch Changes',
}

function generateBumpTypeSection(
  changes: PackageRelease['changes'],
  bumpType: BumpType,
  subheadingLevel: number,
): string | null {
  let filtered = changes.filter((c) => c.bump === bumpType)

  if (filtered.length === 0) {
    return null
  }

  // Sort with breaking changes hoisted to top, then alphabetically by filename
  let sorted = [...filtered].sort((a, b) => {
    let aBreaking = hasBreakingChangePrefix(a.content)
    let bBreaking = hasBreakingChangePrefix(b.content)
    if (aBreaking !== bBreaking) return aBreaking ? -1 : 1
    return a.file.localeCompare(b.file)
  })

  let lines: string[] = []
  let subheadingPrefix = '#'.repeat(subheadingLevel)

  lines.push(`${subheadingPrefix} ${sectionTitles[bumpType]}`)
  lines.push('')

  for (let change of sorted) {
    lines.push(formatChangelogEntry(change.content))
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Generates changelog content for a package release
 */
export function generateChangelogContent(
  release: PackageRelease,
  options: {
    /** Whether to include package name in heading. Default: false */
    includePackageName?: boolean
    /** Markdown heading level (2 = ##, 3 = ###). Default: 2 */
    headingLevel?: 2 | 3
  } = {},
): string {
  let { includePackageName = false, headingLevel = 2 } = options
  let lines: string[] = []

  let headingPrefix = '#'.repeat(headingLevel)
  let packagePart = includePackageName ? `${release.packageName} ` : ''
  lines.push(`${headingPrefix} ${packagePart}v${release.nextVersion}`)
  lines.push('')

  let subheadingLevel = headingLevel + 1

  // Generate sections in order: major, minor, patch (skipping empty sections)
  for (let bumpType of bumpTypes) {
    let section = generateBumpTypeSection(release.changes, bumpType, subheadingLevel)
    if (section) {
      lines.push(section)
    }
  }

  return lines.join('\n')
}

/**
 * Generates the commit message for all releases
 */
export function generateCommitMessage(releases: PackageRelease[]): string {
  let subject = 'Version Packages'
  let body = releases
    .map((r) => `- ${r.packageName}: ${r.currentVersion} -> ${r.nextVersion}`)
    .join('\n')

  return `${subject}\n\n${body}`
}

// =============================================================================
// CHANGELOG.md parsing utilities (for reading already-released changes)
// =============================================================================

interface ChangelogEntry {
  version: string
  date?: Date
  body: string
}

type AllChangelogEntries = Record<string, ChangelogEntry>

/**
 * Parses a package's CHANGELOG.md and returns all version entries
 */
function parseChangelog(packageDirName: string): AllChangelogEntries | null {
  let changelogPath = getPackageFile(packageDirName, 'CHANGELOG.md')

  if (!fileExists(changelogPath)) {
    return null
  }

  let changelog = readFile(changelogPath)
  let parser = /^## ([a-z\d\.\-]+)(?: \(([^)]+)\))?$/gim

  let result: AllChangelogEntries = {}

  let match
  while ((match = parser.exec(changelog))) {
    let [_, versionString, dateString] = match
    let lastIndex = parser.lastIndex
    let version = versionString.startsWith('v') ? versionString.slice(1) : versionString
    let date = dateString ? new Date(dateString) : undefined
    let nextMatch = parser.exec(changelog)
    let body = changelog.slice(lastIndex, nextMatch ? nextMatch.index : undefined).trim()
    result[version] = { version, date, body }
    parser.lastIndex = lastIndex
  }

  return result
}

/**
 * Gets a specific version's entry from a package's CHANGELOG.md.
 * Accepts an npm package name (e.g., "@remix-run/static-middleware" or "remix").
 */
export function getChangelogEntry({
  packageName,
  version,
}: {
  packageName: string
  version: string
}): ChangelogEntry | null {
  let dirName = packageNameToDirectoryName(packageName)
  if (dirName === null) {
    return null
  }

  let allEntries = parseChangelog(dirName)
  if (allEntries !== null) {
    return allEntries[version] ?? null
  }

  return null
}
