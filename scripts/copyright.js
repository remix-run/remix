const fsp = require("fs").promises;
const path = require("path");
const util = require("util");
const glob = util.promisify(require("glob"));

const buildDir = path.resolve(__dirname, "../build");
const copyrightFile = path.resolve(__dirname, "../COPYRIGHT.md");

async function run() {
  let copyright = await fsp.readFile(copyrightFile, "utf-8");
  let banner = "// " + copyright.split("\n").join("\n// ");

  // Only need to do *.d.ts files here because we do the *.js files in Rollup.
  let files = await glob(path.join(buildDir, "**", "*.d.ts"));

  for (let file of files) {
    let contents = await fsp.readFile(file, "utf-8");
    await fsp.writeFile(file, banner + "\n" + contents);
  }

  console.log(`Applied copyright notice to ${files.length} files`);

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
