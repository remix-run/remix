import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { getPackagesSync } = require("@manypkg/get-packages");
const gitStatusResult = spawnSync("git", ["status", "--porcelain"]);

if (gitStatusResult.status !== 0) {
  process.exit(gitStatusResult.status || undefined);
}

const rootDir = path.join(__dirname, "..");

const allPackages = getPackagesSync(rootDir).packages;
const allPackageNames = allPackages.map((pkg) => pkg.packageJson.name);

const pkgChanges = new Map(
  gitStatusResult.stdout
    .toString()
    .trim()
    .split("\n")
    .filter((line) => /^\s*M\s+.*\/package.json/.test(line))
    .map((line) => {
      /**
       * @type {string}
       * This will always be defined but TS doesn't know that
       * @ts-expect-error */
      let gitPath = line.match(/[^\s]+package.json/)[0];
      let fsPath = path.join(rootDir, gitPath);
      let packageJson = require(fsPath);
      let previousPackageJsonResult = spawnSync("git", [
        "show",
        `HEAD:${gitPath}`,
      ]);

      if (previousPackageJsonResult.status !== 0) {
        process.exit(gitStatusResult.status || undefined);
      }

      return [
        packageJson.name,
        {
          path: fsPath,
          packageJson: packageJson,
          versionChanged:
            packageJson.version !==
            JSON.parse(previousPackageJsonResult.stdout.toString().trim())
              .version,
        },
      ];
    })
);

for (let peerPkg of allPackageNames) {
  let peerPkgChange = pkgChanges.get(peerPkg);
  if (!peerPkgChange || !peerPkgChange.versionChanged) {
    continue;
  }

  for (let dependentPkg of allPackages) {
    let peerDeps = dependentPkg.packageJson.peerDependencies;
    if (!peerDeps || !peerDeps[peerPkg]) {
      continue;
    }
    let pkgJsonCopy = { ...dependentPkg.packageJson };
    // TS not smart enough to realize we checked this before copying the object
    // @ts-expect-error
    pkgJsonCopy.peerDependencies[
      peerPkg
    ] = `^${peerPkgChange.packageJson.version}`;

    fs.writeFileSync(
      path.join(dependentPkg.dir, "package.json"),
      JSON.stringify(pkgJsonCopy, null, 2) + "\n"
    );
  }
}
