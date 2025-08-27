import * as cp from 'node:child_process'

import { readFile, readJson, writeFile, writeJson } from './utils/fs.js'
import { getPackageFile } from './utils/packages.js'
import { logAndExec } from './utils/process.js'
import { getNextVersion } from './utils/semver.js'

let packageName = process.argv[2]
let releaseType = process.argv[3]

if (packageName === undefined || releaseType === undefined) {
  console.error('Usage: node tag-release.js <packageName> <releaseType>')
  process.exit(1)
}

let packageJsonFile = getPackageFile(packageName, 'package.json')
let packageJson = readJson(packageJsonFile)
let nextVersion = getNextVersion(packageJson.version, releaseType)
let tag = `${packageName}@${nextVersion}`

// 1) Ensure git staging area is clean
let status = cp.execSync('git status --porcelain').toString()
if (status !== '') {
  console.error('Git staging area is not clean')
  process.exit(1)
}

console.log(`Tagging release ${tag} ...`)
console.log()

// 2) Update package.json with the new release version
writeJson(packageJsonFile, { ...packageJson, version: nextVersion })
logAndExec(`git add ${packageJsonFile}`)

// 3) Update jsr.json (if applicable) with the new release version
// let jsrJsonFile = getPackageFile(packageName, 'jsr.json');
// if (fileExists(jsrJsonFile)) {
//   let jsrJson = readJson(jsrJsonFile);
//   writeJson(jsrJsonFile, { ...jsrJson, version: nextVersion });
//   logAndExec(`git add ${jsrJsonFile}`);
// }

// 4) Swap out "## HEAD" in CHANGELOG.md with the new release version + date
let changelogFile = getPackageFile(packageName, 'CHANGELOG.md')
let changelog = readFile(changelogFile)
let match = /^## HEAD\n/m.exec(changelog)
if (match) {
  let [today] = new Date().toISOString().split('T')

  changelog =
    changelog.slice(0, match.index) +
    `## v${nextVersion} (${today})\n` +
    changelog.slice(match.index + match[0].length)

  writeFile(changelogFile, changelog)
  logAndExec(`git add ${changelogFile}`)
}

// 5) Commit and tag
logAndExec(`git commit -m "Release ${tag}"`)
logAndExec(`git tag ${tag}`)

console.log()
