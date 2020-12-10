const path = require("path");
const fsp = require("fs").promises;
const { exec, spawn } = require("child_process");
const { promisify } = require("util");

const npmModulesDir = path.resolve(
  __dirname,
  "../build/node_modules/@remix-run"
);

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
  // - Make sure there's a current tag
  let taggedVersion = await getTaggedVersion();
  invariant(
    taggedVersion !== "",
    `Missing release version. Run the version script first.`
  );

  // - Publish all packages, starting with core
  let basePackageNames = await fsp.readdir(npmModulesDir);
  basePackageNames.sort(a => (a === "core" ? -1 : 0));

  for (let name of basePackageNames) {
    let tag = figureOutTag();
    await npm(["publish", "--tag", tag, path.join(npmModulesDir, name)], {
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
