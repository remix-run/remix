const { execSync } = require("child_process");
const { readdirSync } = require("fs");
const { resolve, join } = require("path");

const packageDir = resolve(__dirname, "../packages");

const run = async () => {
  const packages = readdirSync(packageDir, { withFileTypes: true })
    .filter(maybeDir => maybeDir.isDirectory())
    .map(dir => dir.name);

  packages.forEach(pkg => {
    console.log(`Updating dependencies for ${pkg} ...`);

    execSync(
      `cd ${join(packageDir, pkg)} && npx npm-check-updates -u -t minor`
    );
  });
};

run().then(
  () => {
    process.exit(0);
  },
  error => {
    console.error(error);
    process.exit(1);
  }
);
