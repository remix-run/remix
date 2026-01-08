/**
 * Opens or updates the version PR.
 *
 * Usage:
 *   node scripts/changes-version-pr.ts [--preview]
 *
 * Environment:
 *   GITHUB_TOKEN - Required (unless --preview)
 */
import { validateAllChanges, getAllReleases, generateCommitMessage } from './utils/changes.ts'
import { generatePrBody } from './utils/version-pr.ts'
import { logAndExec } from './utils/process.ts'
import { findOpenPr, createPr, updatePr, setPrPkgLabels, closePr } from './utils/github.ts'

let args = process.argv.slice(2)
let preview = args.includes('--preview')

let baseBranch = 'main'
let prBranch = 'changes-version-pr/main'
let prTitle = 'Version Packages'

async function main() {
  console.log(preview ? '🔍 PREVIEW MODE\n' : '')

  // Validate changes
  console.log('Validating change files...')
  let validationResult = validateAllChanges()
  if (validationResult.errorCount > 0) {
    console.error('Validation errors found:')
    for (let [pkg, errors] of Object.entries(validationResult.errorsByPackage)) {
      for (let error of errors) {
        console.error(`  ${pkg}/${error.file}: ${error.error}`)
      }
    }
    process.exit(1)
  }

  // Get releases
  let releases = getAllReleases()
  if (releases.length === 0) {
    console.log('No pending changes to release.')

    // Check if there's a stale PR that should be closed
    if (!preview && process.env.GITHUB_TOKEN) {
      let existingPr = await findOpenPr(prBranch, baseBranch)
      if (existingPr) {
        console.log(`\nClosing stale PR #${existingPr.number}...`)
        await closePr(
          existingPr.number,
          'Closing automatically — all change files have been removed or released.',
        )
        console.log(`✅ Closed PR: ${existingPr.html_url}`)
      }
    }

    process.exit(0)
  }

  console.log(`\nFound ${releases.length} package${releases.length === 1 ? '' : 's'} with changes:`)
  for (let release of releases) {
    console.log(`  • ${release.packageName}: ${release.currentVersion} → ${release.nextVersion}`)
  }
  console.log()

  // Generate content
  let commitMessage = generateCommitMessage(releases)
  let prBody = generatePrBody(releases)

  if (preview) {
    console.log('Would create/update PR with:')
    console.log(`  Branch: ${prBranch}`)
    console.log(`  Title: ${prTitle}`)
    console.log(`  Commit: ${commitMessage.split('\n')[0]}`)
    console.log('\nPR Body:')
    console.log('─'.repeat(60))
    console.log(prBody)
    console.log('─'.repeat(60))
    console.log('\nPreview complete. No changes made.')
    process.exit(0)
  }

  // Require token for non-preview
  if (!process.env.GITHUB_TOKEN) {
    console.error('GITHUB_TOKEN environment variable is required')
    process.exit(1)
  }

  // Configure git
  console.log('Configuring git...')
  logAndExec('git config user.name "Remix Run Bot"')
  logAndExec('git config user.email "hello@remix.run"')

  // Create or switch to PR branch
  console.log(`\nSwitching to branch: ${prBranch}`)
  try {
    logAndExec(`git checkout -B ${prBranch}`)
  } catch {
    logAndExec(`git checkout ${prBranch}`)
  }

  // Reset to base branch
  logAndExec(`git reset --hard origin/${baseBranch}`)

  // Run version command
  console.log('\nRunning pnpm changes:version...')
  logAndExec('pnpm changes:version')

  console.log('\nPushing branch...')
  logAndExec(`git push origin ${prBranch} --force`)

  // Create or update PR
  console.log('\nChecking for existing PR...')
  let existingPr = await findOpenPr(prBranch, baseBranch)

  let prNumber: number
  if (existingPr) {
    console.log(`Updating existing PR #${existingPr.number}...`)
    await updatePr(existingPr.number, { title: prTitle, body: prBody })
    prNumber = existingPr.number
    console.log(`\n✅ Updated PR: ${existingPr.html_url}`)
  } else {
    console.log('Creating new PR...')
    let newPr = await createPr({ title: prTitle, body: prBody, head: prBranch, base: baseBranch })
    prNumber = newPr.number
    console.log(`\n✅ Created PR #${newPr.number}: ${newPr.html_url}`)
  }

  // Set package labels
  let packageNames = releases.map((r) => r.packageName)
  console.log(`\nSetting labels: ${packageNames.map((p) => `pkg:${p}`).join(', ')}`)
  await setPrPkgLabels(prNumber, packageNames)
}

main().catch((error) => {
  console.error('Error:', error.message)
  process.exit(1)
})
