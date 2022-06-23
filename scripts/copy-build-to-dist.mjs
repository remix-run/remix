import path from "path";
import fse from "fs-extra";
import chalk from "chalk";

const ROOT_DIR = process.cwd();
const PACKAGES_PATH = path.join(ROOT_DIR, "packages");
const DEFAULT_BUILD_PATH = path.join(ROOT_DIR, "build");

let activeOutputDir = DEFAULT_BUILD_PATH;
if (process.env.REMIX_LOCAL_DEV_OUTPUT_DIRECTORY) {
  let appDir = path.join(
    ROOT_DIR,
    process.env.REMIX_LOCAL_DEV_OUTPUT_DIRECTORY
  );
  try {
    fse.readdirSync(path.join(appDir, "node_modules"));
  } catch (e) {
    console.error(
      "Oops! You pointed `REMIX_LOCAL_DEV_OUTPUT_DIRECTORY` to a directory that " +
        "does not have a `node_modules` folder. Please `npm install` in that " +
        "directory and try again."
    );
    process.exit(1);
  }
  activeOutputDir = appDir;
}

copyBuildToDist();

async function copyBuildToDist() {
  let buildPath = getBuildPath();
  let packages = (await getPackageBuildPaths(buildPath)).map((buildDir) => {
    let parentDir = path.basename(path.dirname(buildDir));
    let dirName = path.basename(buildDir);
    return {
      build: buildDir,
      src: path.join(
        PACKAGES_PATH,
        parentDir === "@remix-run" ? `remix-${dirName}` : dirName
      ),
    };
  });

  /** @type {Promise<void>[]} */
  let copyQueue = [];
  for (let pkg of packages) {
    try {
      let srcPath = path.join(pkg.build, "dist");
      let destPath = path.join(pkg.src, "dist");
      if (!(await fse.stat(srcPath)).isDirectory()) {
        continue;
      }
      copyQueue.push(
        (async () => {
          console.log(
            chalk.yellow(
              `  🛠  Copying ${path.relative(
                ROOT_DIR,
                srcPath
              )} to ${path.relative(ROOT_DIR, destPath)}`
            )
          );
          fse.copy(srcPath, destPath, {
            recursive: true,
          });
        })()
      );
    } catch (e) {}
  }
  await Promise.all(copyQueue);
  console.log(
    chalk.green(
      "  ✅ Successfully copied build files to package dist directories!"
    )
  );
}

/**
 * @param {string} moduleRootDir
 * @returns {Promise<string[]>}
 */
async function getPackageBuildPaths(moduleRootDir) {
  /** @type {string[]} */
  let packageBuilds = [];

  try {
    for (let fileName of await fse.readdir(moduleRootDir)) {
      let moduleDir = path.join(moduleRootDir, fileName);
      if (!(await fse.stat(moduleDir)).isDirectory()) {
        continue;
      }
      if (path.basename(moduleDir) === "@remix-run") {
        packageBuilds.push(...(await getPackageBuildPaths(moduleDir)));
      } else {
        packageBuilds.push(moduleDir);
      }
    }
    return packageBuilds;
  } catch (_) {
    console.error(
      "No build files found. Run `yarn build` before running this script."
    );
    process.exit(1);
  }
}

function getBuildPath() {
  return path.join(activeOutputDir, "node_modules");
}
