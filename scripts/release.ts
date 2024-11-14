import * as cp from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';

import * as semver from 'semver';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

// This script should be run as part of an npm script ("scripts" key in package.json)
// so that it can access the package name and version from environment variables.
const packageName = process.env.npm_package_name;
const packageVersion = process.env.npm_package_version;
const releaseType = process.argv[2];

if (packageName === undefined || packageVersion === undefined || releaseType === undefined) {
  console.error('Usage: npm run release <releaseType>');
  process.exit(1);
}

let newVersion = semver.inc(packageVersion, releaseType as semver.ReleaseType);
let [_packageScope, packageNameWithoutScope] = packageName.split('/');
let packageDir = path.resolve(__dirname, '..', 'packages', packageNameWithoutScope);

// 1) Ensure git staging area is clean
let status = cp.execSync('git status --porcelain').toString();
if (status !== '') {
  console.error('Git staging area is not clean');
  process.exit(1);
}

console.log(`Releasing ${packageNameWithoutScope}@${newVersion} ...`);
console.log();

function logAndExec(command: string) {
  console.log(`$ ${command}`);
  cp.execSync(command, { stdio: 'inherit' });
}

// 2) Update package.json with the new release version
let packageJsonPath = path.relative(process.cwd(), path.join(packageDir, 'package.json'));
let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
logAndExec(`git add ${packageJsonPath}`);

// 3) Swap out "## HEAD" in CHANGELOG.md with the new release version + date
let changelogPath = path.relative(process.cwd(), path.join(packageDir, 'CHANGELOG.md'));
let changelog = fs.readFileSync(changelogPath, 'utf-8');
let match = /^## HEAD\n/m.exec(changelog);
if (match) {
  let [today] = new Date().toISOString().split('T');

  changelog =
    changelog.slice(0, match.index) +
    `## v${newVersion} (${today})\n` +
    changelog.slice(match.index + match[0].length);

  fs.writeFileSync(changelogPath, changelog);
  logAndExec(`git add ${changelogPath}`);
}

// 4) Update jsr.json (if applicable) with the new release version
let jsrJsonPath = path.relative(process.cwd(), path.join(packageDir, 'jsr.json'));
if (fs.existsSync(jsrJsonPath)) {
  let jsrJson = JSON.parse(fs.readFileSync(jsrJsonPath, 'utf-8'));
  jsrJson.version = newVersion;
  fs.writeFileSync(jsrJsonPath, JSON.stringify(jsrJson, null, 2) + '\n');
  logAndExec(`git add ${jsrJsonPath}`);
}

// 5) Commit and tag
let tag = `${packageNameWithoutScope}@${newVersion}`;
logAndExec(`git commit -m "Release ${tag}"`);
logAndExec(`git tag ${tag}`);

console.log();
