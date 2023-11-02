import path from "node:path";
import fse from "fs-extra";
import chalk from "chalk";

const ROOT_DIR = process.cwd();
const BUILD_PATH = path.join(ROOT_DIR, "build");
const PACKAGES_PATH = path.join(ROOT_DIR, "packages");

cleanBuild();

async function cleanBuild() {
  /** @type {Promise<void>[]} */
  let deleteQueue = [removeDir(BUILD_PATH)];
  for (let fileName of await fse.readdir(PACKAGES_PATH)) {
    let buildPath = path.join(PACKAGES_PATH, fileName, "dist");
    deleteQueue.push(removeDir(buildPath));
  }
  await Promise.all(deleteQueue);
  console.log(chalk.green("  ✅ Successfully deleted build files!"));
}

/**
 * @param {string} dir
 */
async function removeDir(dir) {
  try {
    if (!(await fse.stat(dir)).isDirectory()) {
      return;
    }
  } catch (_) {
    return;
  }
  console.log(chalk.yellow(`  🛠  Deleting ${path.relative(ROOT_DIR, dir)}`));
  await fse.remove(dir);
}
