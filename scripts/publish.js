const path = require("path");
const { exec, spawn } = require("child_process");
const { promisify } = require("util");
const semver = require("semver");

const npmModulesDir = path.resolve(__dirname, "../build/node_modules");
const x = promisify(exec);

function invariant(cond, message) {
  if (!cond) throw new Error(message);
}

function npm(args, options) {
  return new Promise((accept, reject) => {
    spawn("npm", args, options).on("close", code => {
      code === 0 ? accept() : reject();
    });
  });
}

async function getTaggedVersion() {
  let { stdout } = await x("git tag --list --points-at HEAD");
  return stdout.trim().replace(/^v/g, "");
}

async function run() {
  // Make sure there's a current tag
  let taggedVersion = await getTaggedVersion();
  invariant(
    taggedVersion !== "",
    `Missing release version. Run the version script first.`
  );

  let prerelease = semver.prerelease(taggedVersion);
  let tag = prerelease ? prerelease[0] : "latest";

  // Publish all @remix-run/* packages
  for (let name of [
    "dev",
    "serve",
    "node",
    "architect",
    "express",
    "vercel",
    "react"
  ]) {
    await npm(
      ["publish", "--tag", tag, path.join(npmModulesDir, "@remix-run", name)],
      { stdio: "inherit" }
    );
  }

  // Publish remix package
  await npm(["publish", "--tag", tag, path.join(npmModulesDir, "remix")], {
    stdio: "inherit"
  });

  // Publish create-remix package
  await npm(
    ["publish", "--tag", tag, path.join(npmModulesDir, "create-remix")],
    { stdio: "inherit" }
  );
}

run().then(
  () => {
    process.exit(0);
  },
  error => {
    console.error(error);
    process.exit(1);
  }
);
