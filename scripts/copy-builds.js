const path = require("path");
const fse = require("fs-extra");
const glob = require("fast-glob");
const chalk = require("chalk");

const { buildDir, REPO_ROOT_DIR } = require("../rollup.utils.js");

let packagesDir = path.join(REPO_ROOT_DIR, "packages");

copyBuilds();

async function copyBuilds() {
  if (process.env.REMIX_LOCAL_BUILD_DIRECTORY) {
    console.log(
      chalk.yellow(
        `\`process.env.REMIX_LOCAL_BUILD_DIRECTORY\` is set. Skipping build copies.`
      )
    );
    return;
  }

  await fse.emptyDir(buildDir);

  let packageFiles = await fse.readdir(packagesDir);
  for (let pkg of packageFiles) {
    let packagePath = path.join(packagesDir, pkg);
    if (!(await fse.stat(packagePath)).isDirectory()) {
      continue;
    }
    let packageJson;
    try {
      packageJson = require(path.join(packagePath, "package.json"));
    } catch (err) {
      throw Error(`Missing package.json in \`${path.join("packages", pkg)}\``);
    }

    let destPackageRoot = path.join(
      buildDir,
      "node_modules",
      ...packageJson.name.split("/")
    );

    let files = [];
    if (Array.isArray(packageJson.files)) {
      // package.json isn't included in our files but we still need to copy it
      files.push({
        src: path.join(packagePath, "package.json"),
        dest: path.join(destPackageRoot, "package.json"),
      });
      for (let file of packageJson.files) {
        let filePath = path.join(packagePath, file);
        if (fse.existsSync(filePath)) {
          let destPath = path.join(destPackageRoot, file);
          files.push({ src: filePath, dest: destPath });
        } else {
          let matched = await glob(file, {
            dot: true,
            cwd: packagePath,
          });
          for (let matchedFile of matched) {
            if (path.basename(matchedFile) === "package.json") {
              continue;
            }
            let filePath = path.join(packagePath, matchedFile);
            let destPath = path.join(destPackageRoot, matchedFile);
            files.push({ src: filePath, dest: destPath });
          }
        }
      }
    } else {
      for (let file of await fse.readdir(packagePath)) {
        if (
          ["rollup.config.js", ".DS_Store", ".gitignore"].includes(
            path.basename(file)
          )
        ) {
          continue;
        }

        let filePath = path.join(packagePath, file);
        let destPath = path.join(destPackageRoot, file);
        files.push({ src: filePath, dest: destPath });
      }
    }

    await Promise.all(
      files.map(async (file) => {
        await fse.ensureDir(path.dirname(file.dest));
        return await fse.copy(file.src, file.dest);
      })
    );
  }

  console.log(
    chalk.green(
      `Copied build output to \`${path.relative(
        REPO_ROOT_DIR,
        buildDir
      )}\` directory`
    )
  );
}
