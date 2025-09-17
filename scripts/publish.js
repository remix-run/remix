const path = require("node:path");
const cp = require("node:child_process");
const fs = require("node:fs");
const semver = require("semver");

const { ensureCleanWorkingDirectory } = require("./utils");

const packageDir = path.resolve(__dirname, "../packages");

const PACKAGES = [
  "remix-eslint-config",
  "remix-server-runtime", // publish before platforms
  "remix-cloudflare",
  "remix-cloudflare-pages",
  "remix-cloudflare-workers",
  "remix-deno",
  "remix-node", // publish node before node servers
  "remix-dev", // publish after node
  "remix-architect",
  "remix-express", // publish express before serve
  "remix-react",
  "remix-serve",
  "remix-fs-routes",
  "remix-css-bundle",
  "remix-testing",
  "remix-route-config",
  "remix-routes-option-adapter",
  "create-remix",
  "remix",
];

function getTaggedVersion() {
  let output = cp.execSync("git tag --list --points-at HEAD").toString().trim();
  return output.replace(/^v/, "").replace(/^remix@/, "");
}

/**
 * @param {string} dir
 * @param {string} tag
 */
function publish(dir, tag) {
  let cmd = `pnpm publish ${dir} --access public --tag ${tag} --no-git-checks`;
  console.log("Publishing command:", cmd);
  cp.execSync(cmd, { stdio: "inherit" });
}

/**
 * @param {string} dir
 * @param {string} tag
 */
function validateVersion(dir, tag) {
  let file = path.join(dir, "package.json");
  let json = JSON.parse(fs.readFileSync(file, "utf8"));
  if (json.version !== tag) {
    throw new Error(
      `Package ${dir} is on version ${json.version}, but should be on ${tag}`
    );
  }
}

async function run() {
  ensureCleanWorkingDirectory();

  // Make sure there's a current tag
  let taggedVersion = getTaggedVersion();

  if (taggedVersion === "") {
    console.error("Missing release version. Run the version script first.");
    process.exit(1);
  }

  console.log("Found tagged version:", taggedVersion);

  let prerelease = semver.prerelease(taggedVersion);
  let prereleaseTag = prerelease ? String(prerelease[0]) : undefined;
  let tag = prereleaseTag
    ? prereleaseTag.includes("nightly")
      ? "nightly"
      : prereleaseTag.includes("experimental")
      ? "experimental"
      : prereleaseTag
    : "latest";

  // Validate all packages
  for (let name of PACKAGES) {
    validateVersion(path.join(packageDir, name), taggedVersion);
  }

  // Publish all packages
  for (let name of PACKAGES) {
    publish(path.join(packageDir, name), tag);
  }
}

run().then(
  () => {
    process.exit(0);
  },
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
