import * as fs from 'node:fs'
import * as path from 'node:path'
import * as semver from 'semver'
import { getAllPackageNames, getPackageDir, getPackageFile } from './packages.ts'
import { fileExists, readFile, readJson } from './fs.ts'

const bumpTypes = ['major', 'minor', 'patch'] as const
type BumpType = (typeof bumpTypes)[number]

// Prerelease configuration (from .changes/prerelease.json)
const prereleaseTagTypes = ['alpha'] as const
type PrereleaseTag = (typeof prereleaseTagTypes)[number]

interface PrereleaseConfig {
  tag: PrereleaseTag
}

type ParsedPrereleaseConfig =
  | { exists: false }
  | { exists: true; valid: true; config: PrereleaseConfig }
  | { exists: true; valid: false; error: string }

/**
 * Reads and validates prerelease.json for a package.
 */
function readPrereleaseConfig(packageName: string): ParsedPrereleaseConfig {
  let packageDir = getPackageDir(packageName)
  let prereleaseJsonPath = path.join(packageDir, '.changes', 'prerelease.json')

  if (!fs.existsSync(prereleaseJsonPath)) {
    return { exists: false }
  }

  let content: unknown
  try {
    content = JSON.parse(fs.readFileSync(prereleaseJsonPath, 'utf-8'))
  } catch {
    return { exists: true, valid: false, error: 'Invalid JSON in prerelease.json' }
  }

  if (typeof content !== 'object' || content === null) {
    return {
      exists: true,
      valid: false,
      error: 'prerelease.json must be an object with a "tag" field',
    }
  }

  let obj = content as Record<string, unknown>

  if (!('tag' in obj)) {
    return { exists: true, valid: false, error: 'prerelease.json must have a "tag" field' }
  }

  if (!prereleaseTagTypes.includes(obj.tag as PrereleaseTag)) {
    return {
      exists: true,
      valid: false,
      error: `prerelease.json "tag" must be one of: ${prereleaseTagTypes.join(', ')} (got: ${obj.tag})`,
    }
  }

  return { exists: true, valid: true, config: { tag: obj.tag as PrereleaseTag } }
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
 * Calculates the next version based on current version, bump type, and prerelease config.
 */
function getNextVersion(
  currentVersion: string,
  bumpType: BumpType,
  prereleaseConfig: PrereleaseConfig | null,
): string {
  let currentPrereleaseId = getPrereleaseIdentifier(currentVersion)
  let isCurrentPrerelease = currentPrereleaseId !== null

  if (prereleaseConfig !== null) {
    // In prerelease mode
    let targetTag = prereleaseConfig.tag

    if (currentPrereleaseId === targetTag) {
      // Same tag - just bump the counter
      let nextVersion = semver.inc(currentVersion, 'prerelease', targetTag)
      if (nextVersion == null) {
        throw new Error(`Invalid prerelease increment: ${currentVersion}`)
      }
      return nextVersion
    } else {
      // Entering prerelease or transitioning to a new tag (e.g., stable → alpha, or alpha → beta)
      // Apply the bump type to get the base version, then add prerelease suffix
      let baseVersion = isCurrentPrerelease
        ? currentVersion.replace(/-.*$/, '') // Strip existing prerelease suffix
        : semver.inc(currentVersion, bumpType as semver.ReleaseType)

      if (baseVersion == null) {
        throw new Error(`Invalid version increment: ${currentVersion} + ${bumpType}`)
      }

      return `${baseVersion}-${targetTag}.0`
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
  package: string
  file: string
  error: string
}

type ParsedPackageChanges =
  | { valid: true; changes: ChangeFile[]; prereleaseConfig: PrereleaseConfig | null }
  | { valid: false; errors: ValidationError[] }

/**
 * Parses and validates all change files for a package.
 * Returns changes if valid, or errors if invalid.
 */
function parsePackageChanges(packageName: string): ParsedPackageChanges {
  let packageDir = getPackageDir(packageName)
  let changesDir = path.join(packageDir, '.changes')
  let changes: ChangeFile[] = []
  let errors: ValidationError[] = []

  // Changes directory should exist (with at least README.md)
  if (!fs.existsSync(changesDir)) {
    return {
      valid: false,
      errors: [
        {
          package: packageName,
          file: '.changes/',
          error: 'Changes directory does not exist',
        },
      ],
    }
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

  // Get package version to determine validation rules
  let packageJsonPath = getPackageFile(packageName, 'package.json')
  let packageJson = readJson(packageJsonPath)
  let currentVersion = packageJson.version as string
  let majorVersion = semver.major(currentVersion)
  let isV1Plus = majorVersion >= 1
  let currentVersionPrereleaseId = getPrereleaseIdentifier(currentVersion)
  let isCurrentVersionPrerelease = currentVersionPrereleaseId !== null

  // Read prerelease.json if it exists
  let parsedPrereleaseConfig = readPrereleaseConfig(packageName)
  let prereleaseConfig: PrereleaseConfig | null = null

  if (parsedPrereleaseConfig.exists) {
    if (!parsedPrereleaseConfig.valid) {
      errors.push({
        package: packageName,
        file: '.changes/prerelease.json',
        error: parsedPrereleaseConfig.error,
      })
      return { valid: false, errors }
    }
    prereleaseConfig = parsedPrereleaseConfig.config
  }

  // Read all files in .changes directory
  let files = fs.readdirSync(changesDir)
  let changeFileNames = files.filter((file) => file !== 'README.md' && file !== 'prerelease.json')
  let hasChangeFiles = changeFileNames.filter((f) => f.endsWith('.md')).length > 0

  // Validate prerelease.json / version consistency
  if (prereleaseConfig !== null) {
    // Config exists
    if (
      currentVersionPrereleaseId !== null &&
      currentVersionPrereleaseId !== prereleaseConfig.tag
    ) {
      // Tag mismatch (e.g., version is alpha but config says beta) - need change files to transition
      if (!hasChangeFiles) {
        errors.push({
          package: packageName,
          file: '.changes/prerelease.json',
          error: `prerelease.json tag '${prereleaseConfig.tag}' doesn't match version's prerelease identifier '${currentVersionPrereleaseId}'. Add a change file to transition to ${prereleaseConfig.tag}.`,
        })
      }
    } else if (!isCurrentVersionPrerelease && !hasChangeFiles) {
      // Config says prerelease but version is stable AND no change files - need change files to enter prerelease
      errors.push({
        package: packageName,
        file: '.changes/prerelease.json',
        error: `prerelease.json exists but version ${currentVersion} is stable. Add a change file to enter prerelease mode, or delete prerelease.json if this package should not be in prerelease.`,
      })
    }
  } else {
    // No config - validate version is stable (unless graduating with change files)
    if (isCurrentVersionPrerelease && !hasChangeFiles) {
      errors.push({
        package: packageName,
        file: '.changes/',
        error: `Version ${currentVersion} is a prerelease but no prerelease.json exists. Either add prerelease.json with { "tag": "${currentVersionPrereleaseId}" }, or add a change file to graduate to stable.`,
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
        package: packageName,
        file,
        error:
          'Change file must be a ".md" file starting with "major.", "minor.", or "patch." (e.g. "minor.add-feature.md")',
      })
      continue
    }

    // Read file content
    let filePath = path.join(changesDir, file)
    let content = fs.readFileSync(filePath, 'utf-8').trim()

    // Check if file is not empty
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

    // Validate breaking change prefix matches the correct bump type (only for stable releases)
    // In prerelease mode, breaking changes don't need special handling since we're just bumping counter
    if (prereleaseConfig === null) {
      let isBreakingChange = hasBreakingChangePrefix(content)

      if (isBreakingChange) {
        if (isV1Plus && bump !== 'major') {
          errors.push({
            package: packageName,
            file,
            error: `Breaking changes in v1+ packages must use "major." prefix (current version: ${currentVersion}). Rename to "major.${file.slice(file.indexOf('.') + 1)}"`,
          })
          continue
        } else if (!isV1Plus && !isCurrentVersionPrerelease && bump !== 'minor') {
          errors.push({
            package: packageName,
            file,
            error: `Breaking changes in v0.x packages must use "minor." prefix (current version: ${currentVersion}). Rename to "minor.${file.slice(file.indexOf('.') + 1)}"`,
          })
          continue
        }
      }
    }

    // File is valid, add to changes
    changes.push({ file, bump, content })
  }

  // Validate entering prerelease requires a major bump
  if (prereleaseConfig !== null && !isCurrentVersionPrerelease && changes.length > 0) {
    let hasMajorBump = changes.some((c) => c.bump === 'major')
    if (!hasMajorBump) {
      errors.push({
        package: packageName,
        file: '.changes/prerelease.json',
        error:
          'Entering prerelease mode requires a major version bump. Add a change file with "major." prefix (e.g. "major.release-v2-alpha.md").',
      })
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return { valid: true, changes, prereleaseConfig }
}

export interface PackageRelease {
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
  let packageNames = getAllPackageNames()
  let releases: PackageRelease[] = []
  let errors: ValidationError[] = []

  for (let packageName of packageNames) {
    let parsed = parsePackageChanges(packageName)

    if (!parsed.valid) {
      errors.push(...parsed.errors)
      continue
    }

    // Only create a release if there are changes
    if (parsed.changes.length > 0) {
      let packageJsonPath = getPackageFile(packageName, 'package.json')
      let packageJson = readJson(packageJsonPath)
      let currentVersion = packageJson.version as string

      let bump = getHighestBump(parsed.changes.map((c) => c.bump))
      if (bump == null) continue

      let nextVersion = getNextVersion(currentVersion, bump, parsed.prereleaseConfig)

      releases.push({
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
  let errorsByPackage: Record<string, ValidationError[]> = {}
  for (let error of errors) {
    if (!errorsByPackage[error.package]) {
      errorsByPackage[error.package] = []
    }
    errorsByPackage[error.package].push(error)
  }

  let lines: string[] = []

  for (let [packageName, packageErrors] of Object.entries(errorsByPackage)) {
    lines.push(`📦 ${packageName}:`)
    for (let error of packageErrors) {
      lines.push(`   ${error.file}: ${error.error}`)
    }
    lines.push('')
  }

  let packageCount = Object.keys(errorsByPackage).length
  lines.push(
    `Found ${errors.length} error${errors.length === 1 ? '' : 's'} in ${packageCount} package${packageCount === 1 ? '' : 's'}`,
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
function parseChangelog(packageName: string): AllChangelogEntries | null {
  let changelogFile = getPackageFile(packageName, 'CHANGELOG.md')

  if (!fileExists(changelogFile)) {
    return null
  }

  let changelog = readFile(changelogFile)
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
 * Gets a specific version's entry from a package's CHANGELOG.md
 */
export function getChangelogEntry(packageName: string, version: string): ChangelogEntry | null {
  let allEntries = parseChangelog(packageName)

  if (allEntries !== null) {
    return allEntries[version] ?? null
  }

  return null
}
