import path from "path";
import fse from "fs-extra";
import chalk from "chalk";

const ROOT_DIR = process.cwd();
const BUILD_PATH = path.join(ROOT_DIR, "build", "node_modules");
const PACKAGES_PATH = path.join(ROOT_DIR, "packages");

copyBuildToDist();

async function copyBuildToDist() {
  /** @type {string[]} */
  let filePaths = [];
  /** @type {string[]} */
  try {
    filePaths = (await fse.readdir(BUILD_PATH)).map((file) =>
      path.join(BUILD_PATH, file)
    );
    if (filePaths.length === 0) {
      throw Error();
    }
  } catch (_) {
    console.error(
      "No build files found. Run `yarn build` before running this script."
    );
    process.exit(1);
  }

  let packages = await getPackagePaths(filePaths);
  /** @type {Promise<void>[]} */
  let copyQueue = [];
  for (let pkg of packages) {
    try {
      if (!(await fse.stat(pkg.dest)).isDirectory()) {
        continue;
      }
      let destPath = path.join(pkg.dest, "dist");
      copyQueue.push(
        ensureCleanDir(destPath).then(() => {
          console.log(
            chalk.yellow(
              `  🛠  Copying ${path.relative(
                ROOT_DIR,
                pkg.src
              )} to ${path.relative(ROOT_DIR, destPath)}`
            )
          );
          return fse.copy(pkg.src, destPath, {
            recursive: true,
          });
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
 * @param {string[]} buildFilePaths
 * @returns {Promise<{ src: string; dest: string }[]>} distFilePaths
 */
async function getPackagePaths(buildFilePaths) {
  /**  @type {{ src: string; dest: string }[]}    */
  let packages = [];
  for (let filePath of buildFilePaths) {
    if (!(await fse.stat(filePath)).isDirectory()) {
      continue;
    }
    let dirName = path.basename(filePath);
    if (dirName === "@remix-run") {
      let childFilePaths = (await fse.readdir(filePath)).map((childFile) =>
        path.join(filePath, childFile)
      );
      packages = packages.concat(await getPackagePaths(childFilePaths));
    } else {
      let parentDir = path.basename(path.dirname(filePath));
      packages.push({
        src: filePath,
        dest: path.join(
          PACKAGES_PATH,
          parentDir === "@remix-run" ? `remix-${dirName}` : dirName
        ),
      });
    }
  }
  return packages;
}

/** @param {string} dirPath */
async function ensureCleanDir(dirPath) {
  await fse.ensureDir(dirPath);
  await fse.emptyDir(dirPath);
}
