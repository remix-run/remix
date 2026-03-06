import * as fs from 'node:fs'
import * as path from 'node:path'
import * as semver from 'semver'
import {
  getAllPackageDirNames,
  getPackageFile,
  getPackagePath,
  packageNameToDirectoryName,
  getTransitiveDependents,
  getGitHubReleaseUrl,
  getPackageDependencies,
  getGitTag,
} from './packages.ts'
import { fileExists, readFile, readJson } from './fs.ts'

const bumpTypes = ['major', 'minor', 'patch'] as const
type BumpType = (typeof bumpTypes)[number]

// Changes configuration (from packages/remix/.changes/config.json)
// Only the remix package supports changes config.
export interface ChangesConfig {
  prereleaseChannel: string
}

export type ParsedChangesConfig =
  | { exists: false }
  | { exists: true; valid: true; config: ChangesConfig }
  | { exists: true; valid: false; error: string }

/**
 * Reads and validates a package's .changes/config.json.
 */
export function readChangesConfig(packageDirName: string): ParsedChangesConfig {
  let packagePath = getPackagePath(packageDirName)
  let configJsonPath = path.join(packagePath, '.changes', 'config.json')

  if (!fs.existsSync(configJsonPath)) {
    return { exists: false }
  }

  let content: unknown
  try {
    content = JSON.parse(fs.readFileSync(configJsonPath, 'utf-8'))
  } catch {
    return { exists: true, valid: false, error: 'Invalid JSON in .changes/config.json' }
  }

  if (typeof content !== 'object' || content === null) {
    return {
      exists: true,
      valid: false,
      error: '.changes/config.json must be an object',
    }
  }

  let obj = content as Record<string, unknown>

  if ('prereleaseChannel' in obj) {
    if (typeof obj.prereleaseChannel !== 'string' || obj.prereleaseChannel.trim().length === 0) {
      return {
        exists: true,
        valid: false,
        error: '.changes/config.json "prereleaseChannel" must be a non-empty string',
      }
    }
    return {
      exists: true,
      valid: true,
      config: { prereleaseChannel: obj.prereleaseChannel.trim() },
    }
  }

  return { exists: true, valid: true, config: { prereleaseChannel: '' } }
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
 * Calculates the next version based on current version, bump type, and changes config.
 */
function getNextVersion(
  currentVersion: string,
  bumpType: BumpType,
  changesConfig: ChangesConfig | null,
): string {
  let currentPrereleaseId = getPrereleaseIdentifier(currentVersion)
  let isCurrentPrerelease = currentPrereleaseId !== null

  if (changesConfig !== null && changesConfig.prereleaseChannel) {
    // In prerelease mode
    let targetChannel = changesConfig.prereleaseChannel

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
  | { valid: true; changes: ChangeFile[]; changesConfig: ChangesConfig | null }
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
      packageDirName,
      file: '.changes/README.md',
      error: 'README.md is missing from .changes directory',
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

  // Handle .changes/config.json - only supported for remix package
  let changesConfig: ChangesConfig | null = null
  let configJsonPath = path.join(changesDir, 'config.json')

  if (packageDirName === 'remix') {
    // For remix, read and validate the changes config
    let parsedChangesConfig = readChangesConfig(packageDirName)
    if (parsedChangesConfig.exists) {
      if (!parsedChangesConfig.valid) {
        errors.push({
          packageDirName,
          file: '.changes/config.json',
          error: parsedChangesConfig.error,
        })
        return { valid: false, errors }
      }
      changesConfig = parsedChangesConfig.config
    }
  } else {
    // For non-remix packages, error if config.json exists
    if (fs.existsSync(configJsonPath)) {
      errors.push({
        packageDirName,
        file: '.changes/config.json',
        error: '.changes/config.json is only supported for the "remix" package. Remove this file.',
      })
      return { valid: false, errors }
    }
  }

  // Read all files in .changes directory
  let files = fs.readdirSync(changesDir)
  let changeFileNames = files.filter((file) => file !== 'README.md' && file !== 'config.json')
  let hasChangeFiles = changeFileNames.filter((f) => f.endsWith('.md')).length > 0

  // Validate changes config / version consistency
  let configPrereleaseChannel = changesConfig?.prereleaseChannel ?? null
  let isActivePrereleaseMode = Boolean(configPrereleaseChannel) && isCurrentVersionPrerelease
  if (configPrereleaseChannel) {
    // Config has prerelease channel
    if (
      currentVersionPrereleaseId !== null &&
      currentVersionPrereleaseId !== configPrereleaseChannel
    ) {
      // Channel mismatch (e.g., version is alpha but config says beta) - need change files to transition
      if (!hasChangeFiles) {
        errors.push({
          packageDirName,
          file: '.changes/config.json',
          error: `prereleaseChannel '${configPrereleaseChannel}' doesn't match version's prerelease identifier '${currentVersionPrereleaseId}'. Add a change file to transition to ${configPrereleaseChannel}.`,
        })
      }
    } else if (!isCurrentVersionPrerelease && !hasChangeFiles) {
      // Config says prerelease but version is stable AND no change files - need change files to enter prerelease
      errors.push({
        packageDirName,
        file: '.changes/config.json',
        error: `prereleaseChannel exists but version ${currentVersion} is stable. Add a change file to enter prerelease mode, or remove prereleaseChannel if this package should not be in prerelease.`,
      })
    }
  } else {
    // No prerelease channel - validate version is stable (unless graduating with change files)
    if (isCurrentVersionPrerelease && !hasChangeFiles) {
      errors.push({
        packageDirName,
        file: '.changes/',
        error: `Version ${currentVersion} is a prerelease but no prereleaseChannel exists. Either add .changes/config.json with { "prereleaseChannel": "${currentVersionPrereleaseId}" }, or add a change file to graduate to stable.`,
      })
    }
  }

  for (let file of changeFileNames) {
    // Skip non-.md files
    if (!file.endsWith('.md')) {
      continue
    }

    // Parse filename format when it follows bump naming (e.g. "minor.add-feature.md")
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

    if (bump == null && isActivePrereleaseMode) {
      // In prerelease mode, bump type does not affect versioning, so any filename is allowed.
      bump = 'patch'
    }

    if (bump == null) {
      errors.push({
        packageDirName,
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
          'Change file should not start with a bullet point (- or *). The bullet will be added automatically in the CHANGELOG. Just write the text directly.',
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
        error: `Headings in change files must be level 4 (####), 5 (#####), or 6 (######), but found level ${headingLevel}. This is because change files are nested within the changelog which already uses heading levels 1-3.`,
      })
      continue
    }

    // Validate breaking change prefix matches the correct bump type (only for stable releases)
    // In prerelease mode, breaking changes don't need special handling since we're just bumping counter
    if (!configPrereleaseChannel) {
      let isBreakingChange = hasBreakingChangePrefix(content)

      if (isBreakingChange) {
        if (isV1Plus && bump !== 'major') {
          errors.push({
            packageDirName,
            file,
            error: `Breaking changes in v1+ packages must use "major." prefix (current version: ${currentVersion}). Rename to "major.${file.slice(file.indexOf('.') + 1)}"`,
          })
          continue
        } else if (!isV1Plus && !isCurrentVersionPrerelease && bump !== 'minor') {
          errors.push({
            packageDirName,
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
  if (configPrereleaseChannel && !isCurrentVersionPrerelease && changes.length > 0) {
    let hasMajorBump = changes.some((c) => c.bump === 'major')
    if (!hasMajorBump) {
      errors.push({
        packageDirName,
        file: '.changes/config.json',
        error:
          'Entering prerelease mode requires a major version bump. Add a change file with "major." prefix (e.g. "major.release-v2-alpha.md").',
      })
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return { valid: true, changes, changesConfig }
}

/**
 * Represents a dependency that was bumped, triggering this release.
 */
export interface DependencyBump {
  packageName: string
  version: string
  releaseUrl: string
}

export interface PackageRelease {
  packageDirName: string
  packageName: string
  currentVersion: string
  nextVersion: string
  bump: BumpType
  changes: ChangeFile[]
  /** Dependencies that were bumped, triggering this release (if any) */
  dependencyBumps: DependencyBump[]
}

type ParsedChanges =
  | { valid: true; releases: PackageRelease[] }
  | { valid: false; errors: ValidationError[] }

/**
 * Parses and validates all change files across all packages.
 * Also includes packages that need to be released due to dependency changes.
 * Returns releases if valid, or errors if invalid.
 */
export function parseAllChangeFiles(): ParsedChanges {
  let packageDirNames = getAllPackageDirNames()
  let errors: ValidationError[] = []

  // Build maps for lookup
  let dirNameToPackageName = new Map<string, string>()
  let packageNameToDirName = new Map<string, string>()

  // First pass: collect package info and validate change files
  interface ParsedPackageInfo {
    packageDirName: string
    packageName: string
    currentVersion: string
    changes: ChangeFile[]
    changesConfig: ChangesConfig | null
  }
  let parsedPackages: ParsedPackageInfo[] = []

  // Read the remix changes config once (only remix supports changes config)
  let remixChangesConfig = readChangesConfig('remix')
  let validRemixChangesConfig: ChangesConfig | null = null
  if (remixChangesConfig.exists && remixChangesConfig.valid) {
    validRemixChangesConfig = remixChangesConfig.config
  }

  for (let packageDirName of packageDirNames) {
    let parsed = parsePackageChanges(packageDirName)

    if (!parsed.valid) {
      errors.push(...parsed.errors)
      continue
    }

    let packageJsonPath = getPackageFile(packageDirName, 'package.json')
    let packageJson = readJson(packageJsonPath)
    let packageName = packageJson.name as string
    let currentVersion = packageJson.version as string

    dirNameToPackageName.set(packageDirName, packageName)
    packageNameToDirName.set(packageName, packageDirName)

    // For remix package, use the changes config even if there are no change files
    // (to correctly bump prerelease counter for dependency-triggered releases)
    let changesConfig = parsed.changesConfig
    if (packageDirName === 'remix' && changesConfig === null && validRemixChangesConfig) {
      changesConfig = validRemixChangesConfig
    }

    parsedPackages.push({
      packageDirName,
      packageName,
      currentVersion,
      changes: parsed.changes,
      changesConfig,
    })
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  // Find packages with direct changes
  let directlyChangedPackages = new Set<string>()
  for (let pkg of parsedPackages) {
    if (pkg.changes.length > 0) {
      directlyChangedPackages.add(pkg.packageName)
    }
  }

  // Find all packages that transitively depend on changed packages
  let transitiveDependents = getTransitiveDependents(directlyChangedPackages)

  // Determine all packages that will be released
  let allReleasingPackages = new Set<string>([
    ...directlyChangedPackages,
    ...transitiveDependents.keys(),
  ])

  // Compute next versions for all releasing packages
  // We need to do this in dependency order to correctly compute dependency bumps
  let packageVersions = new Map<string, string>() // packageName -> nextVersion

  // First, compute versions for directly changed packages
  for (let pkg of parsedPackages) {
    if (pkg.changes.length > 0) {
      let bump = getHighestBump(pkg.changes.map((c) => c.bump))
      if (bump == null) continue
      let nextVersion = getNextVersion(pkg.currentVersion, bump, pkg.changesConfig)
      packageVersions.set(pkg.packageName, nextVersion)
    }
  }

  // Then, compute versions for dependency-triggered releases
  // We need to do this iteratively because a package's version depends on knowing
  // which of its dependencies are being released
  for (let pkg of parsedPackages) {
    if (
      !directlyChangedPackages.has(pkg.packageName) &&
      allReleasingPackages.has(pkg.packageName)
    ) {
      // This package is being released due to dependency changes
      // Use the package's changes config if it has one (e.g., remix in prerelease mode)
      let nextVersion = getNextVersion(pkg.currentVersion, 'patch', pkg.changesConfig)
      packageVersions.set(pkg.packageName, nextVersion)
    }
  }

  // Now build the final releases with dependency bumps
  let releases: PackageRelease[] = []

  for (let pkg of parsedPackages) {
    if (!allReleasingPackages.has(pkg.packageName)) {
      continue
    }

    let nextVersion = packageVersions.get(pkg.packageName)
    if (nextVersion == null) continue

    // Compute dependency bumps: which of this package's direct dependencies are being released?
    let dependencyBumps: DependencyBump[] = []
    let deps = getPackageDependencies(pkg.packageName)

    for (let depName of deps) {
      if (allReleasingPackages.has(depName)) {
        let depVersion = packageVersions.get(depName)
        if (depVersion) {
          dependencyBumps.push({
            packageName: depName,
            version: depVersion,
            releaseUrl: getGitHubReleaseUrl(depName, depVersion),
          })
        }
      }
    }

    // Sort dependency bumps alphabetically by package name
    dependencyBumps.sort((a, b) => a.packageName.localeCompare(b.packageName))

    let bump: BumpType = 'patch'
    if (pkg.changes.length > 0) {
      bump = getHighestBump(pkg.changes.map((c) => c.bump)) ?? 'patch'
    }

    releases.push({
      packageDirName: pkg.packageDirName,
      packageName: pkg.packageName,
      currentVersion: pkg.currentVersion,
      nextVersion,
      bump,
      changes: pkg.changes,
      dependencyBumps,
    })
  }

  // Sort by package name for consistency
  releases.sort((a, b) => a.packageName.localeCompare(b.packageName))

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

function sortChangelogChanges(changes: PackageRelease['changes']): PackageRelease['changes'] {
  // Sort with breaking changes hoisted to top, then alphabetically by filename
  return [...changes].sort((a, b) => {
    let aBreaking = hasBreakingChangePrefix(a.content)
    let bBreaking = hasBreakingChangePrefix(b.content)
    if (aBreaking !== bBreaking) return aBreaking ? -1 : 1
    return a.file.localeCompare(b.file)
  })
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

  let sorted = sortChangelogChanges(filtered)

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

function generatePrereleaseChangesSection(
  changes: PackageRelease['changes'],
  dependencyBumps: DependencyBump[],
  subheadingLevel: number,
): string | null {
  if (changes.length === 0 && dependencyBumps.length === 0) {
    return null
  }

  let lines: string[] = []
  let subheadingPrefix = '#'.repeat(subheadingLevel)
  lines.push(`${subheadingPrefix} Pre-release Changes`)
  lines.push('')

  let sortedChanges = sortChangelogChanges(changes)
  for (let change of sortedChanges) {
    lines.push(formatChangelogEntry(change.content))
    lines.push('')
  }

  if (dependencyBumps.length > 0) {
    lines.push('- Bumped `@remix-run/*` dependencies:')
    for (let dep of dependencyBumps) {
      let tag = getGitTag(dep.packageName, dep.version)
      lines.push(`  - [\`${tag}\`](${dep.releaseUrl})`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Generates the dependency bumps section for a changelog entry
 */
function generateDependencyBumpsSection(
  dependencyBumps: DependencyBump[],
  subheadingLevel: number,
): string | null {
  if (dependencyBumps.length === 0) {
    return null
  }

  let lines: string[] = []
  let subheadingPrefix = '#'.repeat(subheadingLevel)

  lines.push(`${subheadingPrefix} Patch Changes`)
  lines.push('')
  lines.push('- Bumped `@remix-run/*` dependencies:')

  for (let dep of dependencyBumps) {
    let tag = getGitTag(dep.packageName, dep.version)
    lines.push(`  - [\`${tag}\`](${dep.releaseUrl})`)
  }

  lines.push('')

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

  // In prerelease mode, all change-file entries are grouped into a single section.
  let isPrereleaseRelease = getPrereleaseIdentifier(release.nextVersion) !== null
  if (isPrereleaseRelease) {
    let prereleaseSection = generatePrereleaseChangesSection(
      release.changes,
      release.dependencyBumps,
      subheadingLevel,
    )
    if (prereleaseSection) {
      lines.push(prereleaseSection)
    }
    return lines.join('\n')
  }

  // Generate sections in order: major, minor, patch (skipping empty sections)
  for (let bumpType of bumpTypes) {
    let section = generateBumpTypeSection(release.changes, bumpType, subheadingLevel)
    if (section) {
      lines.push(section)
    }
  }

  // Add dependency bumps section if there are any
  // Only add if there are no other patch changes (to avoid duplicate "Patch Changes" heading)
  if (release.dependencyBumps.length > 0) {
    let hasPatchChanges = release.changes.some((c) => c.bump === 'patch')
    if (hasPatchChanges) {
      // Append to existing patch section (without heading)
      lines.push('- Bumped `@remix-run/*` dependencies:')
      for (let dep of release.dependencyBumps) {
        let tag = getGitTag(dep.packageName, dep.version)
        lines.push(`  - [\`${tag}\`](${dep.releaseUrl})`)
      }
      lines.push('')
    } else {
      // Create new patch section with heading
      let section = generateDependencyBumpsSection(release.dependencyBumps, subheadingLevel)
      if (section) {
        lines.push(section)
      }
    }
  }

  return lines.join('\n')
}

/**
 * Generates the commit message for all releases
 */
export function generateCommitMessage(releases: PackageRelease[]): string {
  let subject = 'Release'
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
