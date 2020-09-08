const path = require("path");
const fsp = require("fs").promises;
const { exec, spawn } = require("child_process");
const { promisify } = require("util");

const buildDir = path.resolve(__dirname, "../build/@remix-run");

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
  let output = (await x("git tag --list --points-at HEAD")).toString().trim();
  return output.replace(/^v/g, "");
}

async function run() {
  // 0. Make sure there's a current tag
  let taggedVersion = await getTaggedVersion();
  invariant(
    taggedVersion !== "",
    `Missing release version. Run the version script first.`
  );

  // 1. Publish all packages, starting with core
  let buildNames = await fsp.readdir(buildDir);
  buildNames.sort(a => (a === "core" ? -1 : 0));

  for (let name of buildNames) {
    await npm(["publish", path.join(buildDir, name)], {
      stdio: "inherit"
    });
  }

  return 0;
}

run().then(
  code => {
    process.exit(code);
  },
  error => {
    console.error(error);
    process.exit(1);
  }
);
