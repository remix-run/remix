import * as cp from 'node:child_process'

import { readFile, readJson, writeFile, writeJson } from './utils/fs.js'
import { getPackageFile } from './utils/packages.js'
import { logAndExec } from './utils/process.js'
import { getNextVersion } from './utils/semver.js'

let rawArgs = process.argv.slice(2)

if (rawArgs.length === 0) {
  console.error('Usage:')
  console.error('  node tag-release.js <packageName> <releaseType>')
  console.error('  node tag-release.js <package@releaseType> [<package@releaseType> ...]')
  process.exit(1)
}

/** @typedef {{ packageName: string, releaseType: string }} ReleaseInput */

/** @type {ReleaseInput[]} */
let inputs = []

if (rawArgs.length === 2 && !rawArgs[0].includes('@') && !rawArgs[1].includes('@')) {
  // node tag-release.js <packageName> <releaseType>
  inputs.push({ packageName: rawArgs[0], releaseType: rawArgs[1] })
} else {
  // node tag-release.js <package@releaseType> [<package@releaseType> ...]
  for (let arg of rawArgs) {
    let idx = arg.indexOf('@')
    if (idx <= 0 || idx === arg.length - 1) {
      console.error(`Invalid argument: "${arg}"`)
      console.error('Each argument must be in the form <package@releaseType>')
      process.exit(1)
    }
    let packageName = arg.slice(0, idx)
    let releaseType = arg.slice(idx + 1)
    inputs.push({ packageName, releaseType })
  }
}

// 1) Ensure git staging area is clean
let status = cp.execSync('git status --porcelain').toString()
if (status !== '') {
  console.error('Git staging area is not clean')
  process.exit(1)
}

/** @type {{ packageName: string, currentVersion: string, nextVersion: string, tag: string }[]} */
let releases = []

// 2) For each package, compute next version, update files, and stage changes
for (let { packageName, releaseType } of inputs) {
  let packageJsonFile = getPackageFile(packageName, 'package.json')
  let packageJson = readJson(packageJsonFile)
  let currentVersion = packageJson.version
  let nextVersion = getNextVersion(currentVersion, releaseType)
  let tag = `${packageName}@${nextVersion}`

  console.log(`Tagging release ${tag} ...`)

  // 2a) Update package.json with the new release version
  writeJson(packageJsonFile, { ...packageJson, version: nextVersion })
  logAndExec(`git add ${packageJsonFile}`)

  // 2b) Update jsr.json (if applicable) with the new release version
  // let jsrJsonFile = getPackageFile(packageName, 'jsr.json');
  // if (fileExists(jsrJsonFile)) {
  //   let jsrJson = readJson(jsrJsonFile);
  //   writeJson(jsrJsonFile, { ...jsrJson, version: nextVersion });
  //   logAndExec(`git add ${jsrJsonFile}`);
  // }

  // 2c) Swap out "## Unreleased" in CHANGELOG.md with the new release version + date
  let changelogFile = getPackageFile(packageName, 'CHANGELOG.md')
  let changelog = readFile(changelogFile)
  let match = /^## Unreleased\n/m.exec(changelog)
  if (match) {
    let [today] = new Date().toISOString().split('T')

    changelog =
      changelog.slice(0, match.index) +
      `## v${nextVersion} (${today})\n` +
      changelog.slice(match.index + match[0].length)

    writeFile(changelogFile, changelog)
    logAndExec(`git add ${changelogFile}`)
  }

  releases.push({ packageName, currentVersion, nextVersion, tag })
}

// 3) Commit and create one tag per release
let commitTitle =
  releases.length === 1
    ? `Release ${releases[0].tag}`
    : `Release ${releases.map((r) => r.tag).join(', ')}`
let commitBody = releases
  .map((r) => `- ${r.packageName}: ${r.currentVersion} -> ${r.nextVersion}`)
  .join('\n')

logAndExec(`git commit -m "${commitTitle}" -m "${commitBody}"`)

for (let r of releases) {
  logAndExec(`git tag ${r.tag}`)
}

console.log()
