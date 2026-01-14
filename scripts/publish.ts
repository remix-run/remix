/**
 * Publishes packages to npm and creates tags/releases for what was published.
 *
 * This script publishes packages individually (not using pnpm --recursive) to support
 * per-package dist-tags. Prerelease versions (e.g., 1.0.0-alpha.1) are tagged with their
 * prerelease identifier (e.g., "alpha"), while stable versions are tagged as "latest".
 *
 * This script is designed for CI use. For previewing releases, use `pnpm changes:preview`.
 *
 * Usage:
 *   node scripts/publish.ts [--skip-ci-check] [--dry-run]
 *
 * Options:
 *   --skip-ci-check  Bypass the CI environment check
 *   --dry-run        Show what would be published without actually publishing
 */
import { mapWithConcurrency } from './utils/concurrency.ts'
import { tagExists } from './utils/git.ts'
import { createRelease } from './utils/github.ts'
import { getAllPackageNames, getPackageDir, getPackageFile } from './utils/packages.ts'
import { logAndExec, logAndExecAsync } from './utils/process.ts'
import { buildPublishPlan } from './utils/publish-plan.ts'
import type { PackageInfo, PackagePublishInfo, PublishPlan } from './utils/publish-plan.ts'
import { readJson } from './utils/fs.ts'

let args = process.argv.slice(2)
let skipCiCheck = args.includes('--skip-ci-check')
let dryRun = args.includes('--dry-run')

// Concurrency limits
const NPM_CHECK_CONCURRENCY = 40
const NPM_PUBLISH_CONCURRENCY = 20

/**
 * Get info for all public packages in the workspace.
 * Dependencies only include public workspace packages.
 */
function getPublicPackages(): PackageInfo[] {
  let packageNames = getAllPackageNames()

  // Build a set of all package names in the workspace for dependency filtering
  let workspacePackageNames = new Set<string>()
  for (let packageName of packageNames) {
    let packageJson = readJson(getPackageFile(packageName, 'package.json'))
    workspacePackageNames.add(packageJson.name)
  }

  let packages: PackageInfo[] = []

  for (let packageName of packageNames) {
    let packageJsonPath = getPackageFile(packageName, 'package.json')
    let packageJson = readJson(packageJsonPath)

    if (packageJson.private === true) {
      continue
    }

    let publicDeps = {
      ...packageJson.dependencies,
      ...packageJson.peerDependencies,
    }

    let publicWorkspaceDeps = Object.keys(publicDeps || {}).filter((dep) =>
      workspacePackageNames.has(dep),
    )

    packages.push({
      name: packageJson.name,
      version: packageJson.version,
      directory: getPackageDir(packageName),
      dependencies: publicWorkspaceDeps,
    })
  }

  return packages
}

/**
 * Check if a package version is already published on npm.
 */
async function isVersionPublished(packageName: string, version: string): Promise<boolean> {
  let result = await logAndExecAsync(`npm view ${packageName}@${version} version --json`)
  if (result.error) {
    // npm returns error for unpublished versions
    return false
  }
  let publishedVersion = JSON.parse(result.ok.stdout)
  return publishedVersion === version
}

/**
 * Check which packages are already published on npm.
 * Runs checks in parallel for speed.
 */
async function checkPublishedStatus(packages: PackageInfo[]): Promise<Map<string, boolean>> {
  let results = await mapWithConcurrency(packages, NPM_CHECK_CONCURRENCY, async (pkg) => {
    let isPublished = await isVersionPublished(pkg.name, pkg.version)
    return { key: `${pkg.name}@${pkg.version}`, isPublished }
  })

  let status = new Map<string, boolean>()
  for (let { key, isPublished } of results) {
    status.set(key, isPublished)
  }
  return status
}

// ============================================================================
// Plan Execution - ALL side effects happen below this line
// ============================================================================

interface PublishedPackage {
  name: string
  version: string
  tag: string
  distTag: string
}

interface PublishPlanExecutionResult {
  published: PublishedPackage[]
  failed: Array<{ pkg: PackagePublishInfo; error: string }>
}

/**
 * Execute a publish plan. This is where ALL side effects happen.
 *
 * Packages are published in waves based on dependency order.
 * Within each wave, packages are processed in parallel, and each package
 * goes through the full publish flow atomically: npm publish → git tag → git push → GitHub release.
 *
 * When dryRun is true, this goes through the same code path but logs
 * what would happen instead of executing side effects.
 */
async function executePublishPlan(
  publishPlan: PublishPlan,
  options: { dryRun: boolean },
): Promise<PublishPlanExecutionResult> {
  let { dryRun } = options
  let totalPackages = publishPlan.waves.flat().length

  // Configure git first (needed for tagging)
  if (dryRun) {
    console.log('Would configure git:')
    console.log('  $ git config user.name "Remix Run Bot"')
    console.log('  $ git config user.email "hello@remix.run"')
  } else {
    console.log('Configuring git...')
    logAndExec('git config user.name "Remix Run Bot"')
    logAndExec('git config user.email "hello@remix.run"')
  }

  // Publish packages in waves
  console.log()
  if (dryRun) {
    console.log(
      `Would publish ${totalPackages} packages in ${publishPlan.waves.length} wave${publishPlan.waves.length === 1 ? '' : 's'}...\n`,
    )
  } else {
    console.log(
      `Publishing ${totalPackages} packages in ${publishPlan.waves.length} wave${publishPlan.waves.length === 1 ? '' : 's'}...\n`,
    )
  }

  let published: PublishedPackage[] = []
  let failed: PublishPlanExecutionResult['failed'] = []

  for (let waveIndex = 0; waveIndex < publishPlan.waves.length; waveIndex++) {
    let wave = publishPlan.waves[waveIndex]
    let waveNum = waveIndex + 1

    if (publishPlan.waves.length > 1) {
      console.log(
        `Wave ${waveNum}/${publishPlan.waves.length} (${wave.length} package${wave.length === 1 ? '' : 's'}):`,
      )
    }

    // Each package in the wave goes through the full atomic flow in parallel
    let results = await mapWithConcurrency(wave, NPM_PUBLISH_CONCURRENCY, async (pkg) => {
      return publishPackage(pkg, { dryRun })
    })

    // Collect results from this wave
    for (let { pkg, success, error } of results) {
      if (success) {
        published.push({
          name: pkg.name,
          version: pkg.version,
          tag: pkg.gitTag,
          distTag: pkg.distTag,
        })
      } else {
        failed.push({ pkg, error: error ?? 'Unknown error' })
      }
    }

    // If any packages failed, stop processing further waves
    if (failed.length > 0) {
      return { published, failed }
    }

    if (publishPlan.waves.length > 1 && waveIndex < publishPlan.waves.length - 1) {
      console.log()
    }
  }

  return { published, failed }
}

/**
 * Publish a single package: npm publish → git tag → git push → GitHub release.
 * Each step only proceeds if the previous step succeeded.
 */
async function publishPackage(
  pkg: PackagePublishInfo,
  options: { dryRun: boolean },
): Promise<{ pkg: PackagePublishInfo; success: boolean; error?: string }> {
  let { dryRun } = options
  let publishCommand = `pnpm publish --tag ${pkg.distTag} --access public --no-git-checks`

  if (dryRun) {
    console.log(`  📦 ${pkg.name}@${pkg.version} → ${pkg.distTag}`)
    console.log(`     $ ${publishCommand}`)
    console.log(`     $ git tag ${pkg.gitTag}`)
    console.log(`     $ git push origin ${pkg.gitTag}`)
    console.log(`     → GitHub release`)
    return { pkg, success: true }
  }

  // Step 1: npm publish
  let publishResult = await logAndExecAsync(publishCommand, { cwd: pkg.directory })
  if (publishResult.error) {
    console.log(`  ✗ ${pkg.name}@${pkg.version} (npm publish failed)`)
    if (publishResult.error.stderr) console.log(publishResult.error.stderr)
    return { pkg, success: false, error: publishResult.error.cause.message }
  }

  // Step 2: git tag
  if (tagExists(pkg.gitTag)) {
    // Tag already exists - this is unexpected and needs investigation
    console.log(`  ✗ ${pkg.name}@${pkg.version} (npm published, but tag already exists)`)
    return {
      pkg,
      success: false,
      error: `Tag ${pkg.gitTag} already exists - npm published but tag/release skipped. Investigate and manually create release if needed.`,
    }
  }

  try {
    logAndExec(`git tag ${pkg.gitTag}`)
  } catch (e) {
    console.log(`  ✗ ${pkg.name}@${pkg.version} (git tag failed)`)
    return { pkg, success: false, error: `git tag failed: ${e}` }
  }

  // Step 3: git push the tag
  let pushResult = await logAndExecAsync(`git push origin ${pkg.gitTag}`)
  if (pushResult.error) {
    console.log(`  ✗ ${pkg.name}@${pkg.version} (git push failed)`)
    if (pushResult.error.stderr) console.log(pushResult.error.stderr)
    return { pkg, success: false, error: pushResult.error.cause.message }
  }

  // Step 4: GitHub release
  let releaseResult = await createRelease(pkg.name, pkg.version)
  if (releaseResult.status === 'error') {
    // GitHub API failed - npm + tag are done, so we continue but warn
    console.log(`  ⚠ ${pkg.name}@${pkg.version} (published, but GitHub release failed)`)
  } else if (releaseResult.status === 'skipped') {
    // Release already exists - this is unexpected since we just created the tag
    console.log(`  ✗ ${pkg.name}@${pkg.version} (release already exists)`)
    return {
      pkg,
      success: false,
      error: `Release for ${pkg.gitTag} already exists - unexpected state, please investigate.`,
    }
  } else {
    console.log(`  ✓ ${pkg.name}@${pkg.version}`)
  }

  return { pkg, success: true }
}

// ============================================================================
// Main
// ============================================================================

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

  // Get all public packages
  console.log('Checking packages...')
  let publicPackages = getPublicPackages()

  // Check npm registry for each package (in parallel)
  let startTime = Date.now()
  let publishedStatus = await checkPublishedStatus(publicPackages)
  let checkDuration = Date.now() - startTime

  // Count published vs needs publishing
  let alreadyPublishedCount = 0
  let needsPublishingCount = 0
  for (let pkg of publicPackages) {
    if (publishedStatus.get(`${pkg.name}@${pkg.version}`)) {
      alreadyPublishedCount++
    } else {
      needsPublishingCount++
    }
  }

  console.log(`  Checked ${publicPackages.length} packages in ${checkDuration}ms`)

  // Build the publish plan (pure function - no side effects)
  let publishPlan = buildPublishPlan({
    packages: publicPackages,
    isPublished: (name, version) => publishedStatus.get(`${name}@${version}`) ?? false,
  })

  // Report publish plan summary
  console.log()
  console.log(`Found ${publicPackages.length} public packages:`)
  console.log(`  • ${alreadyPublishedCount} already published (will skip)`)
  console.log(
    `  • ${needsPublishingCount} ${needsPublishingCount === 1 ? 'needs' : 'need'} publishing`,
  )
  console.log()

  if (publishPlan.waves.length === 0) {
    console.log('No packages need publishing.')
    return
  }

  // Execute the publish plan (all side effects happen here)
  let result = await executePublishPlan(publishPlan, { dryRun })

  // Handle results
  if (dryRun) {
    console.log(
      '\n🔍 Dry run complete. No packages published, no git tags or GitHub releases created.',
    )
    return
  }

  if (result.failed.length > 0) {
    console.error(
      `\n❌ ${result.failed.length} package${result.failed.length === 1 ? '' : 's'} failed to publish:`,
    )
    for (let { pkg, error } of result.failed) {
      console.error(`  • ${pkg.name}@${pkg.version}: ${error}`)
    }
    if (result.published.length > 0) {
      console.error(`\nSuccessfully published:`)
      for (let p of result.published) {
        console.error(`  ✓ ${p.name}@${p.version}`)
      }
    }
    process.exit(1)
  }

  console.log(
    `\n${result.published.length} package${result.published.length === 1 ? '' : 's'} published successfully.`,
  )
  console.log('\n✅ Done.')
}

main()
