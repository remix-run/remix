import * as cp from 'node:child_process';

import { readJson } from './utils/fs.js';
import { createRelease } from './utils/github-releases.js';
import { getPackageDir, getPackageFile } from './utils/packages.js';
import { logAndExec } from './utils/process.js';
import { isValidVersion } from './utils/semver.js';

let tag = process.argv[2];

// If no argument provided, try to detect a tag at HEAD
if (tag === undefined) {
  let currentTags = cp
    .execSync('git tag --points-at HEAD')
    .toString()
    .trim()
    .split('\n')
    .filter(Boolean);

  // Look for tags that match the package@version format
  let packageTags = currentTags.filter((tag) => {
    let match = tag.match(/^([^@]+)@(\d+\.\d+\.\d+.*)$/);
    return match && isValidVersion(match[2]);
  });

  if (packageTags.length === 0) {
    console.error('No package tags found at HEAD');
    console.error(`Usage:
    node publish-release.js <tag>
    node publish-release.js # auto-detect tag at HEAD`);
    process.exit(1);
  }

  // TODO: Support tagging and publishing multiple packages at once
  if (packageTags.length > 1) {
    console.error('Multiple package tags found at HEAD:');
    packageTags.forEach((tag) => console.error(`  - ${tag}`));
    console.error('Please specify which tag to publish');
    process.exit(1);
  }

  // Use the single tag found
  tag = packageTags[0];
  console.log(`Auto-detected tag: ${tag}`);
}

// Parse the tag
if (!tag.includes('@')) {
  console.error(`Invalid tag format: "${tag}"`);
  console.error('Tag must be in format: packageName@version');
  process.exit(1);
}

let split = tag.split('@');
let packageName = split[0];
let version = split[1];

if (!packageName || !version) {
  console.error(`Invalid tag: "${tag}"`);
  process.exit(1);
}
if (packageName === '' || !isValidVersion(version)) {
  console.error(`Invalid tag: "${tag}"`);
  process.exit(1);
}

// 1) Ensure git staging area is clean
let status = cp.execSync('git status --porcelain').toString();
if (status !== '') {
  console.error('Git staging area is not clean');
  process.exit(1);
}

// 2) Ensure we are on the right tag
let currentTags = cp.execSync('git tag --points-at HEAD').toString().trim().split('\n');
if (!currentTags.includes(tag)) {
  console.error(`Tag "${tag}" does not point to HEAD`);
  process.exit(1);
}

console.log(`Publishing release ${tag} ...`);
console.log();

// 3) Publish to npm
let packageJsonFile = getPackageFile(packageName, 'package.json');
let packageJson = readJson(packageJsonFile);
if (packageJson.version !== version) {
  console.error(
    `Tag does not match package.json version: ${version} !== ${packageJson.version} (${tag})`,
  );
  process.exit(1);
}

logAndExec(`pnpm publish --access public --no-git-checks`, {
  cwd: getPackageDir(packageName),
  env: process.env,
});
console.log();

// 4) Publish to jsr (if applicable)
// let jsrJsonFile = getPackageFile(packageName, 'jsr.json');
// if (fileExists(jsrJsonFile)) {
//   let jsrJson = readJson(jsrJsonFile);
//   if (jsrJson.version !== version) {
//     console.error(
//       `Tag does not match jsr.json version: ${version} !== ${jsrJson.version} (${tag})`,
//     );
//     process.exit(1);
//   }

//   logAndExec(`npx jsr publish`, {
//     cwd: getPackageDir(packageName),
//     env: process.env,
//   });
//   console.log();
// }

// 5) Publish to GitHub Releases
console.log(`Publishing ${tag} on GitHub Releases ...`);
let releaseUrl = await createRelease(packageName, version);
console.log(`Done, see ${releaseUrl}`);

console.log();
