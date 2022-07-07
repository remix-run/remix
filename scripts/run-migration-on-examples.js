const { execSync } = require("child_process");
const { readdir, stat } = require("fs/promises");
const { join } = require("path");

/**
 * @param {string} migration
 */
const main = async (migration) => {
  if (!migration) {
    console.error("Please specify a migration to run");
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

    execSync(
      `node ${cliPath} migrate --migration ${migration} --force ${examplePath}`,
      { stdio: "inherit" }
    );
  });
};

main(process.argv[2]);
