import path from "path";
import fse from "fs-extra";
import chalk from "chalk";

const ROOT_DIR = process.cwd();
const BUILD_PATH = path.join(ROOT_DIR, "build", "node_modules");
const PACKAGES_PATH = path.join(ROOT_DIR, "packages");

copyBuildToDist();

async function copyBuildToDist() {
  /** @type {{ build: string; src: string }[]} */
  let packages = (await getPackageBuildPaths(BUILD_PATH)).map((buildDir) => {
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
        new Promise((res) => {
          console.log(
            chalk.yellow(
              `  🛠  Copying ${path.relative(
                ROOT_DIR,
                srcPath
              )} to ${path.relative(ROOT_DIR, destPath)}`
            )
          );
          res(
            fse.copy(srcPath, destPath, {
              recursive: true,
            })
          );
        })
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
