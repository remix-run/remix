const { execSync } = require("node:child_process");
const { readdir, stat } = require("node:fs/promises");
const { join } = require("node:path");

/**
 * @param {string} codemod
 */
const main = async (codemod) => {
  if (!codemod) {
    console.error("Please specify a codemod to run");
    process.exit(1);
  }

  let buildPath = join(__dirname, "../", "build");
  let cliPath = join(
    buildPath,
    "node_modules",
    "@remix-run",
    "dev",
    "dist",
    "cli.js"
  );
  let examplesPath = join(process.cwd(), "examples");
  let examples = await readdir(examplesPath);

  examples.forEach(async (example) => {
    let examplePath = join(examplesPath, example);
    let stats = await stat(examplePath);

    if (!stats.isDirectory()) {
      return;
    }

    execSync(`node ${cliPath} codemod ${codemod} --force ${examplePath}`, {
      stdio: "inherit",
    });
  });
};

main(process.argv[2]);
