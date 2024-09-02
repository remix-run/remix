import chalk from "chalk";
import fse from "fs-extra";
import path from "node:path";

const args = process.argv.slice(2);
const tsc = process.env.CI || args.includes("--tsc");

const ROOT_DIR = process.cwd();
const PACKAGES_PATH = path.join(ROOT_DIR, "packages");
const DEFAULT_BUILD_PATH = path.join(ROOT_DIR, "build");

// pnpm workspaces do not understand Deno projects and vice versa so we need to specify which projects need their node_modules updating
const DENO_NODE_MODULES_PATHS = [
  path.join(ROOT_DIR, "integration/helpers/vite-deno-template/node_modules"),
];

let activeOutputDir = DEFAULT_BUILD_PATH;
if (process.env.LOCAL_BUILD_DIRECTORY) {
  let appDir = path.resolve(process.env.LOCAL_BUILD_DIRECTORY);
  try {
    fse.readdirSync(path.join(appDir, "node_modules"));
  } catch {
    console.error(
      "Oops! You pointed `LOCAL_BUILD_DIRECTORY` to a directory that " +
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
      nodeModulesPath:
        parentDir === "@remix-run" ? `${parentDir}/${dirName}` : dirName,
    };
  });

  // Write an export shim for @remix-run/node/globals types
  let dest = path.join(
    ".",
    "build",
    "node_modules",
    "@remix-run",
    "node",
    "globals.d.ts"
  );
  console.log(chalk.yellow(`  🛠     Writing globals.d.ts shim to ${dest}`));
  await fse.writeFile(dest, "export * from './dist/globals';");

  /** @type {Promise<void>[]} */
  let copyQueue = [];
  for (let pkg of packages) {
    try {
      // Copy entire build artifact to node_modules dir for each Deno project that requires it
      for (let denoNodeModulesPath of DENO_NODE_MODULES_PATHS) {
        let destPath = path.join(denoNodeModulesPath, pkg.nodeModulesPath);
        if (await fse.pathExists(destPath)) {
          copyQueue.push(
            (async () => {
              console.log(
                chalk.yellow(
                  `  🛠 🦕  Copying ${path.relative(
                    ROOT_DIR,
                    pkg.build
                  )} to ${path.relative(ROOT_DIR, destPath)}`
                )
              );
              fse.copy(pkg.build, destPath, {
                recursive: true,
              });
            })()
          );
        }
      }

      let srcPath = path.join(pkg.build, "dist");
      let destPath = path.join(pkg.src, "dist");
      if (!(await fse.stat(srcPath)).isDirectory()) {
        continue;
      }
      copyQueue.push(
        (async () => {
          console.log(
            chalk.yellow(
              `  🛠     Copying ${path.relative(
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
    } catch {}
  }

  // One-off deep import copies so folks don't need to import from inside of
  // dist/.  TODO: Remove in a future major release and either get rid of the
  // deep import or manage with the package.json "exports" field
  let oneOffCopies = [
    // server-build.js built by rollup outside of dist/, need to copy to
    // packages/ dir outside of dist/
    [
      "build/node_modules/@remix-run/dev/server-build.js",
      "packages/remix-dev/server-build.js",
    ],
    // server-build.d.ts only built by tsc to dist/.  Copy outside of dist/
    // both in build/ and packages/ dir
    ...(tsc
      ? [
          [
            "build/node_modules/@remix-run/dev/dist/server-build.d.ts",
            "build/node_modules/@remix-run/dev/server-build.d.ts",
          ],
          [
            "build/node_modules/@remix-run/dev/dist/server-build.d.ts",
            "packages/remix-dev/server-build.d.ts",
          ],
          // globals.d.ts shim written outside of dist/ in above, copy to packages/
          // dir outside of dist/
          [
            "build/node_modules/@remix-run/node/globals.d.ts",
            "packages/remix-node/globals.d.ts",
          ],
        ]
      : []),
  ];

  oneOffCopies.forEach(([srcFile, destFile]) =>
    copyQueue.push(
      (async () => {
        let src = path.relative(ROOT_DIR, path.join(...srcFile.split("/")));
        let dest = path.relative(ROOT_DIR, path.join(...destFile.split("/")));
        console.log(chalk.yellow(`  🛠     Copying ${src} to ${dest}`));
        await fse.copy(src, dest);
      })()
    )
  );

  await Promise.all(copyQueue);
  console.log(
    chalk.green(
      "  ✅    Successfully copied build files to package dist directories!"
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
      } else if (
        /node_modules[/\\]@remix-run[/\\]/.test(moduleDir) ||
        /node_modules[/\\]create-remix/.test(moduleDir) ||
        /node_modules[/\\]remix/.test(moduleDir)
      ) {
        packageBuilds.push(moduleDir);
      }
    }
    return packageBuilds;
  } catch (_) {
    console.error(
      "No build files found. Run `pnpm build` before running this script."
    );
    process.exit(1);
  }
}

function getBuildPath() {
  return path.join(activeOutputDir, "node_modules");
}
