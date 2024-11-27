import * as cp from 'node:child_process';

import {
  getPackageFile,
  readChangelog,
  writeChangelog,
  hasJsrJson,
  readJsrJson,
  writeJsrJson,
  readPackageJson,
  writePackageJson,
} from './utils/packages.js';
import { logAndExec } from './utils/process.js';
import { getNextVersion } from './utils/semver.js';

let packageName = process.argv[2];
let releaseType = process.argv[3];

if (packageName === undefined || releaseType === undefined) {
  console.error('Usage: node version.js <packageName> <releaseType>');
  process.exit(1);
}

if (typeof packageName === 'string' && packageName.startsWith('@mjackson/')) {
  packageName = packageName.slice('@mjackson/'.length);
}

let packageJson = readPackageJson(packageName);
let nextVersion = getNextVersion(packageJson.version, releaseType);
let tag = `${packageName}@${nextVersion}`;

// 1) Ensure git staging area is clean
let status = cp.execSync('git status --porcelain').toString();
if (status !== '') {
  console.error('Git staging area is not clean');
  process.exit(1);
}

console.log(`Releasing ${tag} ...`);
console.log();

// 2) Update package.json with the new release version
writePackageJson(packageName, { ...packageJson, version: nextVersion });
logAndExec(`git add ${getPackageFile(packageName, 'package.json')}`);

// 4) Update jsr.json (if applicable) with the new release version
if (hasJsrJson(packageName)) {
  let jsrJson = readJsrJson(packageName);
  writeJsrJson(packageName, { ...jsrJson, version: nextVersion });
  logAndExec(`git add ${getPackageFile(packageName, 'jsr.json')}`);
}

// 3) Swap out "## HEAD" in CHANGELOG.md with the new release version + date
let changelog = readChangelog(packageName);
let match = /^## HEAD\n/m.exec(changelog);
if (match) {
  let [today] = new Date().toISOString().split('T');

  changelog =
    changelog.slice(0, match.index) +
    `## v${nextVersion} (${today})\n` +
    changelog.slice(match.index + match[0].length);

  writeChangelog(packageName, changelog);
  logAndExec(`git add ${getPackageFile(packageName, 'CHANGELOG.md')}`);
}

// 5) Commit and tag
logAndExec(`git commit -m "Release ${tag}"`);
logAndExec(`git tag ${tag}`);

console.log();
