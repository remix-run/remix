import * as cp from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const packageVersion = process.env.npm_package_version;

// Update jsr.json with the current version
let jsrJsonPath = path.resolve(__dirname, '../jsr.json');
let jsrJson = JSON.parse(fs.readFileSync(jsrJsonPath, 'utf-8'));
jsrJson.version = packageVersion;
fs.writeFileSync(jsrJsonPath, JSON.stringify(jsrJson, null, 2) + '\n');
cp.execSync('git add jsr.json');

// Update CHANGELOG.md with the current version
let changelogPath = path.resolve(__dirname, '../CHANGELOG.md');
let changelog = fs.readFileSync(changelogPath, 'utf-8');
let match = /^## HEAD\n/m.exec(changelog);
if (match) {
  let today = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  changelog =
    changelog.slice(0, match.index) +
    `## v${packageVersion} (${today})\n` +
    changelog.slice(match.index + match[0].length);

  fs.writeFileSync(changelogPath, changelog);
  cp.execSync('git add CHANGELOG.md');
} else {
  console.error('Could not find "## HEAD" in CHANGELOG.md');
  process.exit(1);
}
