const path = require("node:path");
const cp = require("node:child_process");
const semver = require("semver");

const buildDir = path.resolve(__dirname, "../build/node_modules");
const packageDir = path.resolve(__dirname, "../packages");

/**
 * @param {string} dir
 * @param {string} tag
 */
function publish(dir, tag) {
  let args = ["--access public", `--tag ${tag}`];
  if (["experimental", "nightly"].includes(tag)) {
    args.push(`--no-git-checks`);
  } else {
    args.push("--publish-branch v2");
  }
  console.log(
    `Running publish command: pnpm publish --dry-run ${dir} ${args.join(" ")}`
  );
  cp.execSync(`pnpm publish --dry-run ${dir} ${args.join(" ")}`, {
    stdio: "inherit",
  });
}

async function run() {
  // Make sure there's a current tag
  let taggedVersion = "";
  try {
    cp.execSync('git tag --list --points-at HEAD | grep -e "^remix@"')
      .toString()
      .trim();
  } catch (e) {}
  if (taggedVersion === "") {
    console.error("Missing release version. Run the version script first.");
    process.exit(1);
  }

  let prerelease = semver.prerelease(taggedVersion);
  let prereleaseTag = prerelease ? String(prerelease[0]) : undefined;
  let tag = prereleaseTag
    ? prereleaseTag.includes("nightly")
      ? "nightly"
      : prereleaseTag.includes("experimental")
      ? "experimental"
      : prereleaseTag
    : "latest";

  // Publish eslint config directly from the package directory
  publish(path.join(packageDir, "remix-eslint-config"), tag);

  // Publish all @remix-run/* packages
  for (let name of [
    "dev",
    "server-runtime", // publish before platforms
    "cloudflare",
    "cloudflare-pages",
    "cloudflare-workers",
    "deno",
    "node", // publish node before node servers
    "architect",
    "express", // publish express before serve
    "react",
    "serve",
    "fs-routes",
    "css-bundle",
    "testing",
    "route-config",
    "routes-option-adapter",
  ]) {
    publish(path.join(buildDir, "@remix-run", name), tag);
  }

  // Publish create-remix
  publish(path.join(buildDir, "create-remix"), tag);

  // Publish remix package
  publish(path.join(buildDir, "remix"), tag);
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
