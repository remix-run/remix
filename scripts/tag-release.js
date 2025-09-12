import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as semver from "semver";

const packagesDir = path.join(process.cwd(), "packages");

let releaseType = process.argv[2];

if (releaseType === undefined) {
  console.error("Usage: node tag-release.js <releaseType>");
  process.exit(1);
}

// 1) Ensure git staging area is clean
let status = cp.execSync("git status --porcelain").toString();
if (status !== "") {
  console.error("Git staging area is not clean");
  process.exit(1);
}

const packageFolders = fs
  .readdirSync(packagesDir)
  .filter((name) => fs.statSync(path.join(packagesDir, name)).isDirectory());

let nextVersion;
let tags = [];

// 2) Update package.json with the new release version
for (let folder of packageFolders) {
  let packageJsonFile = path.join("packages", folder, "package.json");
  let packageJson = JSON.parse(fs.readFileSync(packageJsonFile).toString());
  let _version = semver.inc(
    packageJson.version,
    /** @type {semver.ReleaseType} */ (releaseType)
  );

  if (_version == null) {
    throw new Error(
      `Invalid version increment: ${packageJson.version} + ${releaseType}`
    );
  }

  if (!nextVersion) {
    nextVersion = _version;
  } else if (nextVersion !== _version) {
    console.error(
      `Version mismatch: ${packageJson.name} would be ${_version}, expected ${nextVersion}`
    );
    process.exit(1);
  }

  fs.writeFileSync(
    packageJsonFile,
    JSON.stringify({ ...packageJson, version: nextVersion }, null, 2) + "\n"
  );
  logAndExec(`git add ${packageJsonFile}`);

  tags.push(`${packageJson.name}@${nextVersion}`);
}

// 3) Swap out "## HEAD" in CHANGELOG.md with the new release version + date
let changelogFile = path.join(process.cwd(), "CHANGELOG.md");
let changelog = fs.readFileSync(changelogFile).toString();
let match = /^## HEAD\n/m.exec(changelog);
if (match) {
  let [today] = new Date().toISOString().split("T");

  changelog =
    changelog.slice(0, match.index) +
    `## v${nextVersion} (${today})\n` +
    changelog.slice(match.index + match[0].length);

  fs.writeFileSync(changelogFile, changelog);
  logAndExec(`git add ${changelogFile}`);
}

// 4) Commit and tag
console.log(`Tagging releases:\n. ${tags.join("\n  ")}`);
console.log();

logAndExec(`git commit -m "Release ${nextVersion}"`);
tags.forEach((t) => logAndExec(`git tag ${t}`));

console.log();

/**
 * @param {string} command
 * @param {cp.ExecSyncOptions} [options]
 * @returns {void}
 */
function logAndExec(command, options = {}) {
  console.log(`$ ${command}`);
  cp.execSync(command, { stdio: "inherit", ...options });
}
