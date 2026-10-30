import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import * as util from 'node:util'

import { getPreviewTarballUrl, preparePreviewPackage } from './utils/preview.ts'
import type { PreviewPackageManifest } from './utils/preview.ts'
import {
  getRetainedPreviewBuilds,
  loadPreviousPreview,
  restorePreviewTarballs,
  writePreviewManifest,
} from './utils/preview-retention.ts'
import { logAndExec } from './utils/process.ts'

/**
 * Build and pack every package onto an installable preview branch. Internal
 * dependencies point to the other tarballs in the same build. Generated commits
 * belong only on preview branches and must never be merged back into source.
 *
 * Usage: pnpm setup-installable-branch preview/main
 * Push the resulting branch, then install the URL printed by this script.
 */
const { positionals } = util.parseArgs({ allowPositionals: true })
const installableBranch = positionals[0]
if (!installableBranch || positionals.length !== 1) {
  throw new Error('Usage: pnpm setup-installable-branch <installable-branch>')
}

logAndExec('git', ['check-ref-format', '--branch', installableBranch], true)
if (logAndExec('git', ['status', '--porcelain'], true)) {
  throw new Error('Error: Git working directory is not clean. Commit or stash changes first.')
}

const sha = logAndExec('git', ['rev-parse', 'HEAD'], true)
const repository = process.env.GITHUB_REPOSITORY ?? 'remix-run/remix'
const previous = loadPreviousPreview(installableBranch)
const builds = getRetainedPreviewBuilds(installableBranch, previous?.manifest.builds ?? [], sha)
const existingBuild = builds.find((build) => build.sha === sha)
if (builds.some((build) => build.sha !== sha && build.sha.slice(0, 8) === sha.slice(0, 8))) {
  throw new Error(`Preview SHA prefix collision for ${sha}`)
}
const tarballsDir = path.resolve('t', sha.slice(0, 8))
const packages = await readPackages()
const tarballUrls = new Map(
  packages.map(({ dirName, manifest }) => [
    manifest.name,
    getPreviewTarballUrl(installableBranch, sha, dirName, repository),
  ]),
)
const remixUrl = tarballUrls.get('remix')
if (!remixUrl) throw new Error('Missing remix package')

console.log(`Preparing installable branch \`${installableBranch}\` from sha ${sha}`)
// Copy retained artifacts onto source without chaining generated preview commits.
logAndExec('git', ['checkout', '-B', installableBranch])
if (previous) restorePreviewTarballs(previous, builds)
if (!existingBuild) {
  logAndExec('pnpm', ['--filter', './packages/*', 'run', 'build'])

  // Prepare generated files while the workspace manifests still point to source.
  for (let { manifest } of packages) {
    if (manifest.scripts?.prepack) {
      logAndExec('pnpm', ['--filter', manifest.name, 'run', 'prepack'])
    }
  }
}

await fsp.mkdir(tarballsDir, { recursive: true })
for (let { dirName, manifest } of packages) {
  let pkg = preparePreviewPackage(manifest, tarballUrls)
  await fsp.writeFile(`packages/${dirName}/package.json`, JSON.stringify(pkg, null, 2) + '\n')
}

if (!existingBuild) {
  for (let { dirName } of packages) {
    logAndExec('pnpm', [
      '--dir',
      `packages/${dirName}`,
      'pack',
      '--out',
      path.join(tarballsDir, `${dirName}.tgz`),
    ])
  }
  builds.push({ sha, createdAt: new Date().toISOString() })
}

await writePreviewManifest({
  branch: installableBranch,
  sha,
  packages: Object.fromEntries(tarballUrls),
  builds,
})

// Built files and generated templates remain ignored; only the packed artifacts
// and rewritten manifests are needed on the preview branch.
logAndExec('git', [
  'add',
  't',
  ...packages.map(({ dirName }) => `packages/${dirName}/package.json`),
])
logAndExec('git', ['commit', '-m', `installable tarballs from ${sha}`])

console.log(
  [
    '',
    `✅ Done! Push \`${installableBranch}\` to GitHub, then install via:`,
    '',
    `  pnpm add "${remixUrl}"`,
    '',
    'The preview branch moves with each build. Use the new URL when updating a preview.',
  ].join('\n'),
)

async function readPackages() {
  let entries = await fsp.readdir('packages', { withFileTypes: true })
  let packages: { dirName: string; manifest: PreviewPackageManifest }[] = []
  for (let entry of entries) {
    if (!entry.isDirectory()) continue
    let manifest: PreviewPackageManifest = JSON.parse(
      await fsp.readFile(`packages/${entry.name}/package.json`, 'utf-8'),
    )
    if (manifest.private) continue
    packages.push({ dirName: entry.name, manifest })
  }
  return packages
}
