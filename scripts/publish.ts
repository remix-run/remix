/**
 * Publishes packages to npm and creates tags/releases for what was published.
 *
 * This script uses pnpm publish with trusted publishing authentication, then
 * creates Git tags + GitHub releases. When one or more packages are in
 * prerelease mode (have .changes/config.json with prereleaseChannel), it publishes
 * in two phases: all other packages as "latest", then prerelease packages with
 * the "next" tag.
 *
 * This script is designed for CI use. For previewing releases, use `pnpm changes:preview`.
 *
 * Usage:
 *   node scripts/publish.ts [--skip-ci-check] [--dry-run]
 *
 * Options:
 *   --skip-ci-check  Bypass the CI environment check
 *   --dry-run        Show what would be published without actually publishing.
 *                    Queries npm to determine unpublished packages and previews
 *                    what the GitHub releases would look like.
 */
import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import {
  findVersionIntroductionCommit,
  getLocalTagTarget,
  getRemoteTagTarget,
  tagExists,
} from './utils/git.ts'
import { createRelease, releaseExists } from './utils/github.ts'
import { getRootDir, logAndExec } from './utils/process.ts'
import { readChangesConfig, getChangelogEntries } from './utils/changes.ts'
import {
  getAllPackageDirNames,
  getPackageFile,
  getGitTag,
  packageNameToDirectoryName,
  getPackageShortName,
  getPackageDependencies,
  getPackagePath,
} from './utils/packages.ts'
import { readJson, fileExists } from './utils/fs.ts'
import { createPublishPlan, getReleaseNotes, isPackageVersionPublished } from './utils/publish.ts'

const rootDir = getRootDir()

const args = process.argv.slice(2)
const skipCiCheck = args.includes('--skip-ci-check')
const dryRun = args.includes('--dry-run')

interface PublishedPackage {
  packageName: string
  version: string
  tag: string
}

interface LocalPackage {
  dirName: string
  npmName: string
  localVersion: string
}

interface PrereleasePackage {
  dirName: string
  channel: string
}

interface TagPlan {
  pkg: PublishedPackage
  targetCommit: string
}

/**
 * Get local package metadata from the workspace.
 */
function getLocalPackages(): LocalPackage[] {
  let packageDirNames = getAllPackageDirNames()
  let localPackages: LocalPackage[] = []

  for (let packageDirName of packageDirNames) {
    let packageJsonPath = getPackageFile(packageDirName, 'package.json')

    // Skip directories without a package.json
    if (!fileExists(packageJsonPath)) {
      continue
    }

    let packageJson = readJson(packageJsonPath)
    localPackages.push({
      dirName: packageDirName,
      npmName: packageJson.name as string,
      localVersion: packageJson.version as string,
    })
  }

  return localPackages
}

function getPrereleasePackages(): PrereleasePackage[] {
  let prereleasePackages: PrereleasePackage[] = []

  for (let packageDirName of getAllPackageDirNames()) {
    let changesConfig = readChangesConfig(packageDirName)
    if (!changesConfig.exists) {
      continue
    }

    if (!changesConfig.valid) {
      throw new Error(`Error reading ${packageDirName} changes config: ${changesConfig.error}`)
    }

    let prereleaseChannel = changesConfig.config.prereleaseChannel
    if (prereleaseChannel) {
      prereleasePackages.push({
        dirName: packageDirName,
        channel: prereleaseChannel,
      })
    }
  }

  prereleasePackages.sort((a, b) => {
    if (a.dirName === 'remix') return -1
    if (b.dirName === 'remix') return 1
    return a.dirName.localeCompare(b.dirName)
  })

  return prereleasePackages
}

/**
 * Get all packages that have versions not yet published to npm.
 */
async function getUnpublishedPackages(): Promise<PublishedPackage[]> {
  let localPackages = getLocalPackages()

  // Query npm for all packages in parallel
  let npmResults = await Promise.all(
    localPackages.map(async (pkg) => ({
      pkg,
      isPublished: await isPackageVersionPublished(pkg.npmName, pkg.localVersion),
    })),
  )

  // Filter to unpublished packages
  let unpublished: PublishedPackage[] = []
  for (let { pkg, isPublished } of npmResults) {
    if (!isPublished) {
      unpublished.push({
        packageName: pkg.npmName,
        version: pkg.localVersion,
        tag: getGitTag(pkg.npmName, pkg.localVersion),
      })
    }
  }

  return unpublished
}

/**
 * Find package versions that are already published to npm but missing git tags.
 * This enables release recovery after partial publish failures.
 */
async function getPublishedPackagesMissingTags(): Promise<PublishedPackage[]> {
  let localPackages = getLocalPackages()

  let npmResults = await Promise.all(
    localPackages.map(async (pkg) => ({
      pkg,
      isPublished: await isPackageVersionPublished(pkg.npmName, pkg.localVersion),
    })),
  )

  let missingTags: PublishedPackage[] = []
  for (let { pkg, isPublished } of npmResults) {
    if (!isPublished) {
      continue
    }

    let tag = getGitTag(pkg.npmName, pkg.localVersion)
    if (!tagExists(tag)) {
      missingTags.push({
        packageName: pkg.npmName,
        version: pkg.localVersion,
        tag,
      })
    }
  }

  return missingTags
}

/**
 * Find package versions that are already published and tagged but missing GitHub releases.
 * This enables release recovery after tags were pushed successfully.
 */
async function getPublishedPackagesMissingReleases(): Promise<PublishedPackage[]> {
  let localPackages = getLocalPackages()

  let npmResults = await Promise.all(
    localPackages.map(async (pkg) => ({
      pkg,
      isPublished: await isPackageVersionPublished(pkg.npmName, pkg.localVersion),
    })),
  )

  let missingReleases: PublishedPackage[] = []
  for (let { pkg, isPublished } of npmResults) {
    if (!isPublished) {
      continue
    }

    let tag = getGitTag(pkg.npmName, pkg.localVersion)
    if (!tagExists(tag)) {
      continue
    }

    if (!(await releaseExists(tag))) {
      missingReleases.push({
        packageName: pkg.npmName,
        version: pkg.localVersion,
        tag,
      })
    }
  }

  return missingReleases
}

function dedupePublishedPackages(packages: PublishedPackage[]): PublishedPackage[] {
  let seenTags = new Set<string>()
  let deduped: PublishedPackage[] = []

  for (let pkg of packages) {
    if (seenTags.has(pkg.tag)) {
      continue
    }
    seenTags.add(pkg.tag)
    deduped.push(pkg)
  }

  return deduped
}

function isShallowRepository(): boolean {
  try {
    let output = cp.execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
      stdio: 'pipe',
      encoding: 'utf-8',
    })
    return output.trim() === 'true'
  } catch {
    return false
  }
}

function ensureGitHistoryForVersionLookup() {
  if (isShallowRepository()) {
    console.log('\nRepository is shallow, fetching full history for release tag anchoring...')
    logAndExec('git fetch --unshallow --tags origin')
    return
  }

  console.log('\nFetching tags from origin...')
  logAndExec('git fetch --tags origin')
}

function resolveTagPlans(packages: PublishedPackage[]): TagPlan[] {
  let plans: TagPlan[] = []

  for (let pkg of packages) {
    let packageDirName = packageNameToDirectoryName(pkg.packageName)
    if (packageDirName === null) {
      throw new Error(
        `Could not map package "${pkg.packageName}" to a workspace directory for tag anchoring.`,
      )
    }

    let packageJsonPath = path
      .relative(rootDir, getPackageFile(packageDirName, 'package.json'))
      .replaceAll('\\', '/')

    let targetCommit = findVersionIntroductionCommit(packageJsonPath, pkg.version)
    if (targetCommit === null) {
      throw new Error(
        `Could not find commit that introduced ${pkg.packageName}@${pkg.version} from ${packageJsonPath}. Ensure full git history is available.`,
      )
    }

    plans.push({ pkg, targetCommit })
  }

  return plans
}

function verifyTagTargets(tagPlans: TagPlan[]) {
  let mismatches: Array<{
    tag: string
    scope: 'local' | 'remote'
    actual: string
    expected: string
  }> = []

  for (let plan of tagPlans) {
    let localTarget = getLocalTagTarget(plan.pkg.tag)
    if (localTarget !== null && localTarget !== plan.targetCommit) {
      mismatches.push({
        tag: plan.pkg.tag,
        scope: 'local',
        actual: localTarget,
        expected: plan.targetCommit,
      })
    }

    let remoteTarget = getRemoteTagTarget(plan.pkg.tag)
    if (remoteTarget !== null && remoteTarget !== plan.targetCommit) {
      mismatches.push({
        tag: plan.pkg.tag,
        scope: 'remote',
        actual: remoteTarget,
        expected: plan.targetCommit,
      })
    }
  }

  if (mismatches.length > 0) {
    let lines = ['Detected existing tags pointing at unexpected commits:']
    for (let mismatch of mismatches) {
      lines.push(
        `  • ${mismatch.tag} (${mismatch.scope}) expected ${mismatch.expected.slice(0, 12)} but found ${mismatch.actual.slice(0, 12)}`,
      )
    }
    lines.push('Refusing to continue to avoid creating inconsistent release metadata.')
    throw new Error(lines.join('\n'))
  }
}

interface ChangelogWarning {
  packageName: string
  version: string
}

/**
 * Preview GitHub releases for packages that would be published.
 * Returns warnings for packages with missing changelog entries.
 */
async function getReleaseBody(pkg: PublishedPackage): Promise<string | null> {
  let entries = getChangelogEntries({ packageName: pkg.packageName })
  if (entries === null) {
    return null
  }

  return getReleaseNotes({
    entries,
    targetVersion: pkg.version,
    isVersionPublished: (version) => isPackageVersionPublished(pkg.packageName, version),
  })
}

async function previewGitHubReleases(
  packages: PublishedPackage[],
): Promise<{ warnings: ChangelogWarning[] }> {
  let warnings: ChangelogWarning[] = []

  console.log('GitHub Release Preview')
  console.log('═'.repeat(60))
  console.log()

  for (let pkg of packages) {
    let tagName = getGitTag(pkg.packageName, pkg.version)
    let releaseName = `${getPackageShortName(pkg.packageName)} v${pkg.version}`
    let releaseBody = await getReleaseBody(pkg)
    let body = releaseBody ?? 'No changelog entry found for this version.'

    if (releaseBody === null) {
      warnings.push({ packageName: pkg.packageName, version: pkg.version })
    }

    console.log(`📦 ${releaseName}`)
    console.log(`   Tag: ${tagName}`)
    console.log()
    console.log('   Release notes:')
    console.log()
    for (let line of body.split('\n')) {
      console.log(`   ${line}`)
    }
    console.log()
    console.log('─'.repeat(60))
    console.log()
  }

  return { warnings }
}

async function main() {
  // Safety check: this script should only run in CI when not in dry run mode
  if (!process.env.CI && !skipCiCheck && !dryRun) {
    console.error('The publish script is designed for CI use only.')
    console.error('Use --skip-ci-check to bypass this check for local use.')
    console.error('Use --dry-run to preview the publish process.')
    console.error('\nFor previewing releases, use: pnpm changes:preview')
    process.exit(1)
  }

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No packages will be published\n')
  }

  let prereleasePackages: PrereleasePackage[] = []
  try {
    prereleasePackages = getPrereleasePackages()
  } catch (error) {
    let message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exit(1)
  }

  if (prereleasePackages.length > 0) {
    console.log('Packages in prerelease mode:')
    for (let pkg of prereleasePackages) {
      console.log(`  • ${pkg.dirName} (${pkg.channel})`)
    }
    console.log()
    console.log(
      'Publishing in two phases: other packages as "latest", then prerelease packages as "next"\n',
    )
  }

  // Publish packages to npm
  console.log('Publishing packages to npm...\n')

  let unpublished = await getUnpublishedPackages()
  let publishPlan = createPublishPlan({
    packages: unpublished,
    prereleaseDirNames: new Set(prereleasePackages.map((pkg) => pkg.dirName)),
    getDirectoryName: packageNameToDirectoryName,
    getDependencies: getPackageDependencies,
  })
  let published: PublishedPackage[] = []

  if (dryRun && publishPlan.length > 0) {
    console.log('Would run:')
  }

  for (let plan of publishPlan) {
    let packageDir = getPackagePath(plan.dirName)
    let relativePackageDir = path.relative(rootDir, packageDir)

    if (dryRun) {
      console.log(
        `  $ (cd ${relativePackageDir} && pnpm run --if-present prepublishOnly && pnpm pack)`,
      )
      console.log(
        `  $ pnpm publish <package tarball> --access public --tag ${plan.npmTag} --no-git-checks`,
      )
      continue
    }

    console.log(`$ (cd ${relativePackageDir} && pnpm run --if-present prepublishOnly)`)
    cp.execFileSync('pnpm', ['run', '--if-present', 'prepublishOnly'], {
      cwd: packageDir,
      stdio: 'inherit',
    })

    let packDir = fs.mkdtempSync(path.join(os.tmpdir(), `remix-publish-${plan.dirName}-`))
    try {
      console.log(`$ (cd ${relativePackageDir} && pnpm pack)`)
      cp.execFileSync('pnpm', ['pack', '--pack-destination', packDir], {
        cwd: packageDir,
        stdio: 'inherit',
      })

      let tarballs = fs.readdirSync(packDir).filter((file) => file.endsWith('.tgz'))
      if (tarballs.length !== 1) {
        throw new Error(
          `Expected pnpm pack to create one tarball for ${plan.packageName}, found ${tarballs.length}.`,
        )
      }

      let tarballPath = path.join(packDir, tarballs[0])
      console.log(
        `$ pnpm publish ${path.basename(tarballPath)} --access public --tag ${plan.npmTag} --no-git-checks`,
      )
      cp.execFileSync(
        'pnpm',
        ['publish', tarballPath, '--access', 'public', '--tag', plan.npmTag, '--no-git-checks'],
        {
          cwd: packageDir,
          stdio: 'inherit',
        },
      )
    } finally {
      fs.rmSync(packDir, { recursive: true, force: true })
    }

    published.push(plan)
  }

  if (dryRun && publishPlan.length > 0) {
    console.log()
  }

  // In dry run mode, query npm to determine what would be published
  // and preview the GitHub releases. This is designed to be run against
  // the contents of the "Release" PR / `pnpm changes:version` output.
  if (dryRun) {
    console.log('Checking npm for unpublished versions...\n')

    if (unpublished.length === 0) {
      console.log('All package versions are already published to npm.')
      console.log('\n🔍 Dry run complete.')
      return
    }

    console.log(
      `${unpublished.length} package${unpublished.length === 1 ? '' : 's'} would be published:\n`,
    )
    for (let pkg of unpublished) {
      console.log(`  • ${pkg.packageName}@${pkg.version}`)
    }
    console.log()

    let { warnings } = await previewGitHubReleases(unpublished)

    if (warnings.length > 0) {
      console.log('⚠️  WARNINGS')
      console.log('═'.repeat(60))
      console.log()
      console.log('The following packages have no changelog entry for their version:')
      console.log()
      for (let warning of warnings) {
        console.log(`  • ${warning.packageName} v${warning.version}`)
      }
      console.log()
      console.log('Their GitHub releases will show "No changelog entry found for this version."')
      console.log('This may indicate a missing or malformed CHANGELOG.md entry.')
      console.log()
    }

    console.log(
      '🔍 Dry run complete. No packages published, no git tags or GitHub releases created.',
    )
    return
  }

  if (published.length > 0) {
    console.log(`\n${published.length} package${published.length === 1 ? '' : 's'} published:`)
    for (let pkg of published) {
      console.log(`  • ${pkg.packageName}@${pkg.version}`)
    }
  } else {
    console.log('\nNo new packages were published.')
  }

  let packagesNeedingTagsOrReleases = dedupePublishedPackages([
    ...published,
    ...(await getPublishedPackagesMissingTags()),
    ...(await getPublishedPackagesMissingReleases()),
  ])

  if (packagesNeedingTagsOrReleases.length === 0) {
    console.log('\nNo packages need git tags or GitHub releases.')
    return
  }

  ensureGitHistoryForVersionLookup()

  console.log('\nResolving release tag targets...')
  let tagPlans = resolveTagPlans(packagesNeedingTagsOrReleases)

  for (let plan of tagPlans) {
    console.log(`  • ${plan.pkg.tag} -> ${plan.targetCommit.slice(0, 12)}`)
  }

  verifyTagTargets(tagPlans)

  // Configure git
  console.log('\nConfiguring git...')
  logAndExec('git config user.name "Remix Run Bot"')
  logAndExec('git config user.email "hello@remix.run"')

  // Create tags (skip if already exist)
  console.log(`\nCreating tag${tagPlans.length === 1 ? '' : 's'} for published packages...`)
  let createdTags: TagPlan[] = []
  for (let plan of tagPlans) {
    let localTarget = getLocalTagTarget(plan.pkg.tag)
    let remoteTarget = getRemoteTagTarget(plan.pkg.tag)

    if (localTarget !== null || remoteTarget !== null) {
      let existingTarget = localTarget ?? remoteTarget
      console.log(`  ⊘ ${plan.pkg.tag} (already exists at ${existingTarget?.slice(0, 12)})`)
      continue
    }

    cp.execFileSync('git', ['tag', plan.pkg.tag, plan.targetCommit], { stdio: 'pipe' })
    console.log(`  ✓ ${plan.pkg.tag} -> ${plan.targetCommit.slice(0, 12)}`)
    createdTags.push(plan)
  }

  // Push tags if any were created
  if (createdTags.length > 0) {
    console.log(`\nPushing tag${createdTags.length === 1 ? '' : 's'}...`)
    for (let plan of createdTags) {
      let ref = `refs/tags/${plan.pkg.tag}`
      process.stdout.write(`  $ git push origin ${ref}\n`)
      try {
        cp.execFileSync('git', ['push', 'origin', ref], { stdio: 'inherit' })
      } catch {
        let remoteTarget = getRemoteTagTarget(plan.pkg.tag)
        if (remoteTarget === plan.targetCommit) {
          console.log(
            `  ⊘ ${plan.pkg.tag} (already exists remotely at ${plan.targetCommit.slice(0, 12)})`,
          )
          continue
        }
        throw new Error(
          `Failed to push ${plan.pkg.tag}, and remote target does not match expected commit ${plan.targetCommit.slice(0, 12)}.`,
        )
      }
    }
  } else {
    console.log('\nNo new tags to push.')
  }

  // Create GitHub releases (skip if already exists)
  console.log('\nCreating GitHub releases...')
  let failedReleases: Array<{ pkg: PublishedPackage; error: string }> = []

  for (let pkg of packagesNeedingTagsOrReleases) {
    let releaseBody = await getReleaseBody(pkg)
    let result = await createRelease(
      pkg.packageName,
      pkg.version,
      releaseBody === null ? {} : { body: releaseBody },
    )
    if (result.status === 'created') {
      console.log(`  ✓ ${pkg.packageName} v${pkg.version}`)
    } else if (result.status === 'skipped') {
      console.log(`  ⊘ ${pkg.packageName} v${pkg.version} (${result.reason.toLowerCase()})`)
    } else {
      console.log(`  ✗ ${pkg.packageName} v${pkg.version} (failed)`)
      failedReleases.push({ pkg, error: result.error })
    }
  }

  // Report any failures
  if (failedReleases.length > 0) {
    console.error('\n⚠️  Some GitHub releases failed to create:')
    for (let { pkg, error } of failedReleases) {
      console.error(`  • ${pkg.packageName} v${pkg.version}: ${error}`)
    }
    console.error('\nYou may need to create these releases manually.')
    process.exit(1)
  }

  console.log('\n✅ Done.')
}

main()
