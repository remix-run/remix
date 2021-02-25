const fsp = require("fs").promises;
const path = require("path");
const util = require("util");
const glob = util.promisify(require("glob"));

const buildDir = path.resolve(__dirname, "../build");
const licenseFile = path.resolve(__dirname, "../LICENSE.md");

async function run() {
  let license = await fsp.readFile(licenseFile, "utf-8");
  let banner = "// " + license.split("\n").join("\n// ");

  // Only need to do *.d.ts files here because we do the *.js files in Rollup.
  let files = await glob(path.join(buildDir, "**", "*.d.ts"));

  for (let file of files) {
    let contents = await fsp.readFile(file, "utf-8");
    await fsp.writeFile(file, banner + "\n" + contents);
  }

  console.log(
    `Applied license to ${files.length} files in ./${path.relative(
      process.cwd(),
      buildDir
    )}`
  );

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
