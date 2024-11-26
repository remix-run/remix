import * as cp from 'node:child_process';

import { hasJsrJson, readJsrJson, readPackageJson } from './utils/packages.js';
import { isValidVersion } from './utils/semver.js';

const tag = process.argv[2];

if (tag === undefined) {
  console.error('Usage: node publish.js <tag>');
  process.exit(1);
}

const [packageName, version] = tag.split('@');

if (packageName === undefined || packageName === '' || !isValidVersion(version)) {
  console.error(`Invalid tag: ${tag}`);
  process.exit(1);
}

// 1) Ensure we are on the right tag
let currentTags = cp.execSync('git tag --points-at HEAD').toString().trim().split('\n');
if (!currentTags.includes(tag)) {
  console.error(`Tag not found: ${tag}`);
  process.exit(1);
}

// 2) Build the package
console.log(`Building ${packageName}@${version} ...`);

// 3) Publish to npm
let packageJson = readPackageJson(packageName);
if (packageJson.version !== version) {
  console.error(
    `Tag does not match package.json version: ${version} !== ${packageJson.version} (${tag})`,
  );
  process.exit(1);
}

console.log(`Publishing ${packageName}@${version} to npm ...`);

// 4) Publish to jsr (if applicable)
if (hasJsrJson(packageName)) {
  let jsrJson = readJsrJson(packageName);
  if (jsrJson.version !== version) {
    console.error(
      `Tag does not match jsr.json version: ${version} !== ${jsrJson.version} (${tag})`,
    );
    process.exit(1);
  }

  console.log(`Publishing ${packageName}@${version} to jsr ...`);
}

// 5) Publish to GitHub Releases
console.log(`Publishing ${packageName}@${version} to GitHub Releases ...`);

console.log();
