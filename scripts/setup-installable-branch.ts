import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import * as util from 'node:util'
import { logAndExec } from './utils/process.ts'

/**
 * This script prepares a base branch (usually `main`) to be PNPM-installable
 * directly from GitHub via a new branch (usually `preview/main`):
 *
 *   pnpm install "remix-run/remix#preview/main&path:packages/remix"
 *
 * To do this, we can run a build, make some minor changes to the repo, and
 * commit the build + changes to the new branch. These changes would never be
 * down-merged back to the source branch.
 *
 * This script does the following:
 *  - Checks out the new branch and resets it to the base (current) branch
 *  - Runs a build
 *  - Removes `dist/` from `.gitignore`
 *  - Updates all internal `@remix-run/*` deps to use the github format for the
 *    given installable branch
 *  - Copies all `publishConfig`'s down so we get `exports` from `dist/` instead of `src/`
 *  - Commits the changes
 *
 * Then, after pushing, `pnpm install "remix-run/remix#preview/main&path:packages/remix"`
 * sees the `remix` nested deps and they all point to github with similar URLs so
 * they install as nested deps the same way.
 */

const { positionals } = util.parseArgs({
  allowPositionals: true,
})

// Use first positional argument or fall back to --branch flag or default
const installableBranch = positionals[0]
if (!installableBranch) {
  throw new Error('Error: You must provide an installable branch name')
}

// Error if git status is not clean
const gitStatus = logAndExec('git status --porcelain', true)
if (gitStatus) {
  throw new Error('Error: Git working directory is not clean. Commit or stash changes first.')
}

// Capture the current branch name
const sha = logAndExec('git rev-parse --short HEAD ', true).trim()

console.log(`Preparing installable branch \`${installableBranch}\` from sha ${sha}`)

// Switch to new branch and reset to current commit on base branch
logAndExec(`git checkout -B ${installableBranch}`)

// Build dist/ folders
logAndExec('pnpm build')

await updateGitignore()
await updatePackageDependencies()
await runCliPrepack()

logAndExec('git add .')
logAndExec(`git commit -a -m "installable build from ${sha}"`)

console.log(
  [
    '',
    `✅ Done!`,
    '',
    `You can now push the \`${installableBranch}\` branch to GitHub and install via:`,
    '',
    `  pnpm install "remix-run/remix#${installableBranch}&path:packages/remix"`,
  ].join('\n'),
)

// Remove `dist` from gitignore so we include built code in the repo
async function updateGitignore() {
  let linesToRemove = new Set(['dist/', '/packages/cli/template/'])
  let gitignorePath = path.join(process.cwd(), '.gitignore')
  let content = await fsp.readFile(gitignorePath, 'utf-8')
  let filtered = content
    .split('\n')
    .filter((line) => !linesToRemove.has(line.trim()))
    .join('\n')
  await fsp.writeFile(gitignorePath, filtered)
  console.log('Updated .gitignore')
}

// Run the cli package's `prepack` script to sync the CLI template, then strip
// the prepack/postpack scripts so they don't run again when the installable
// branch is consumed. Warn if `prepack` has been removed upstream.
async function runCliPrepack() {
  let cliPackageJsonPath = path.join(process.cwd(), 'packages', 'cli', 'package.json')
  let pkg = JSON.parse(await fsp.readFile(cliPackageJsonPath, 'utf-8'))
  if (!pkg.scripts?.prepack) {
    console.warn(
      '⚠️  @remix-run/cli no longer defines a `prepack` script — skipping CLI template sync. ' +
        'If the template is still required on the installable branch, update setup-installable-branch.ts.',
    )
    return
  }

  console.log('Running CLI prepack script...')
  logAndExec('pnpm --filter @remix-run/cli run prepack')

  delete pkg.scripts.prepack
  delete pkg.scripts.postpack
  await fsp.writeFile(cliPackageJsonPath, JSON.stringify(pkg, null, 2) + '\n')
  console.log('Removed prepack/postpack scripts from @remix-run/cli')
}

// Update `package.json` files to point to this branch on github
async function updatePackageDependencies() {
  let packagesDir = path.join(process.cwd(), 'packages')

  let packageDirNames = await fsp.readdir(packagesDir, { withFileTypes: true })

  for (let dir of packageDirNames) {
    if (!dir.isDirectory()) continue

    let packageJsonPath = path.join(packagesDir, dir.name, 'package.json')
    let content = await fsp.readFile(packageJsonPath, 'utf-8')
    let pkg = JSON.parse(content)

    // Point all `@remix-run/` dependencies to this branch on github
    if (pkg.dependencies) {
      for (let name of Object.keys(pkg.dependencies)) {
        if (name.startsWith('@remix-run/')) {
          let packageDirName = name.replace('@remix-run/', '')
          pkg.dependencies[name] =
            `remix-run/remix#${installableBranch}&path:packages/${packageDirName}`
        }
      }
    }

    // Apply `publishConfig` overrides
    if (pkg.publishConfig) {
      Object.assign(pkg, pkg.publishConfig)
      delete pkg.publishConfig
    }

    await fsp.writeFile(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n')
    console.log(`Updated ${dir.name}`)
  }

  console.log('Done')
}
