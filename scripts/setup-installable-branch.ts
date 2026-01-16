import * as cp from 'node:child_process'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'

/**
 * This script prepares the current branch (assumed to be `future`) to be
 * PNPM-installable directly from GitHub via:
 *
 *   pnpm install "github:remix-run/remix#<BRANCH>&path:<PATH>"
 *
 * For example, installing `remix` from a `next` branch:
 *
 *   pnpm install "github:remix-run/remix#next&path:packages/remix"
 *
 * To do this, we can run a build and make some minor changes to the repo,
 * so we would always plan to checkout from the source branch and run/commit
 * these changes in a new branch (the installable branch).  These changes would
 * never be down-merged back to the source branch.
 *
 * This script does the following:
 *  - Runs a build
 *  - Removes `dist/` from `.gitignore`
 *  - Moves all `@remix-run/*` peerDeps up to normal deps to get past any peerDep
 *    warnings on install
 *  - Updates all internal `@remix-run/*` deps to use the `github:` format for the
 *    given installable branch
 *  - Copies all `publishConfig`'s down so we get `exports` from `dist/` instead of `src/`
 *
 * Then, `pnpm install "github:remix-run/remix#<BRANCH>&path:packages/remix"` sees the
 * `remix` nested deps and they all point to github with similar URLs so they install
 * as nested deps the same way.
 */

cp.execSync('pnpm build', { stdio: 'inherit' })
await updateGitignore()
await updatePackageDependencies()

// Remove `dist` from gitignore so we include built code in the repo
async function updateGitignore() {
  let gitignorePath = path.join(process.cwd(), '.gitignore')
  let content = await fsp.readFile(gitignorePath, 'utf-8')
  let filtered = content
    .split('\n')
    .filter((line) => !line.trim().startsWith('dist'))
    .join('\n')
  await fsp.writeFile(gitignorePath, filtered)
  console.log('Updated .gitignore')
}

// Update `package.json` files to point to this branch on github
async function updatePackageDependencies() {
  let packagesDir = path.join(process.cwd(), 'packages')
  let branch = 'future-build'

  let packageDirs = await fsp.readdir(packagesDir, { withFileTypes: true })

  for (let dir of packageDirs) {
    if (!dir.isDirectory()) continue

    let packageJsonPath = path.join(packagesDir, dir.name, 'package.json')
    let content = await fsp.readFile(packageJsonPath, 'utf-8')
    let pkg = JSON.parse(content)

    // To avoid any peerDep warnings, move any `@remix-run/` peerDeps to deps
    if (pkg.peerDependencies) {
      for (let name of Object.keys(pkg.peerDependencies)) {
        if (name.startsWith('@remix-run/')) {
          if (!pkg.dependencies) pkg.dependencies = {}
          pkg.dependencies[name] = pkg.peerDependencies[name]
          delete pkg.peerDependencies[name]
        }
      }
    }

    // Point all `@remix-run/` dependencies to this branch on github
    if (pkg.dependencies) {
      for (let name of Object.keys(pkg.dependencies)) {
        if (name.startsWith('@remix-run/')) {
          let packageName = name.replace('@remix-run/', '')
          pkg.dependencies[name] = `github:remix-run/remix#${branch}&path:packages/${packageName}`
        }
      }
    }

    // Apply `publishConfig` overrides
    if (pkg.publishConfig) {
      if (pkg.name === 'remix' && pkg.publishConfig.peerDependencies) {
        // Delete these from the remix package if they exist
        delete pkg.publishConfig.peerDependencies
      }
      Object.assign(pkg, pkg.publishConfig)
      delete pkg.publishConfig
    }

    await fsp.writeFile(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n')
    console.log(`Updated ${dir.name}`)
  }

  console.log('Done')
}
