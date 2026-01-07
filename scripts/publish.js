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

async function run() {
  ensureCleanWorkingDirectory();

  // Make sure there's a current tag
  let output = cp.execSync("git tag --list --points-at HEAD").toString().trim();
  let taggedVersion = output.replace(/^v/, "").replace(/^remix@/, "");

  if (taggedVersion === "") {
    throw new Error("Missing release version. Run the version script first.");
  }

  console.log("Found tagged version:", taggedVersion);

  let prerelease = semver.prerelease(taggedVersion);
  if (prerelease) {
    throw new Error("Prereleases not supported for v2 publishes");
  }

  // Validate all packages
  for (let name of PACKAGES) {
    let file = path.join(packageDir, name, "package.json");
    let json = JSON.parse(fs.readFileSync(file, "utf8"));
    if (json.version !== taggedVersion) {
      throw new Error(
        `Package ${name} is on version ${json.version}, but should be on ${taggedVersion}`
      );
    }
  }

  let tag = "latest";

  // Publish all packages
  for (let name of PACKAGES) {
    let dir = path.join(packageDir, name);
    let cmd = `pnpm publish ${dir} --access public --tag ${tag} --no-git-checks`;
    console.log("Publishing command:", cmd);
    cp.execSync(cmd, { stdio: "inherit" });
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
