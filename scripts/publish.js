import * as cp from 'node:child_process';

import { createRelease } from './utils/github-releases.js';
import { getPackageDir, hasJsrJson, readJsrJson, readPackageJson } from './utils/packages.js';
import { logAndExec } from './utils/process.js';
import { isValidVersion } from './utils/semver.js';

let tag = process.argv[2];

if (tag === undefined) {
  console.error('Usage: node publish.js <tag>');
  process.exit(1);
}

let [packageName, version] = tag.split('@');

if (packageName === undefined || packageName === '' || !isValidVersion(version)) {
  console.error(`Invalid tag: ${tag}`);
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

// 3) Build the package
console.log(`Building ${packageName}@${version} ...`);

// 4) Publish to npm
let packageJson = readPackageJson(packageName);
if (packageJson.version !== version) {
  console.error(
    `Tag does not match package.json version: ${version} !== ${packageJson.version} (${tag})`,
  );
  process.exit(1);
}

logAndExec(`pnpm publish --access public`, {
  cwd: getPackageDir(packageName),
});

// 5) Publish to jsr (if applicable)
if (hasJsrJson(packageName)) {
  let jsrJson = readJsrJson(packageName);
  if (jsrJson.version !== version) {
    console.error(
      `Tag does not match jsr.json version: ${version} !== ${jsrJson.version} (${tag})`,
    );
    process.exit(1);
  }

  logAndExec(`pnpm dlx jsr publish`, {
    cwd: getPackageDir(packageName),
  });
}

// 6) Publish to GitHub Releases
console.log(`Publishing tag ${tag} on GitHub Releases ...`);

await createRelease(packageName, version);

console.log();
