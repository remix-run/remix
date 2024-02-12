import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import path from "node:path";
import * as url from "node:url";
import { getPackagesSync } from "@manypkg/get-packages";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const rootDir = path.join(__dirname, "..");

Promise.all([
  writeRemixChangelog().then(() => console.log("✅ Wrote `remix` changelog")),
  bumpPeerDepRanges().then(() =>
    console.log("✅ Bumped peer dependency ranges")
  ),
]).then(() => console.log("---\n🎉 Done!"));

/**
 * Consider this scenario:
 * 1. Run `pnpm changeset:version` to bump versions
 * 2. Changesets sees that a package has a minor change
 * 3. Because we release packages in lockstep, all packages get a minor update
 * 4. `@remix-run/dev` has "peerDependencies": { "@remix-run/serve": "1.8.0" }
 * 5. This dependency will now be out of range after the update
 * 6. Changesets makes the safe bet and updates `@remix-run/dev` to 2.0.0
 *    because it can't be sure this doesn't result in a breaking change
 * 7. Because we release packages in lockstep, all packages get a major update
 *
 * In practice, this means any `minor` changeset will result in a major bump,
 * which definitely isn't what we want.
 *
 * Instead, we relaxe the peer dependency range for internal packages. That way
 * the update doesn't result in an out-of-range peer dependency, and all
 * packages are bumped to the next minor release instead.
 *
 * Because changesets doesn't automatically bump peer dependencies with the
 * relaxed range (which makes sense in some cases), this script does that for
 * us. This makes the change safer because updating the leading dependency will
 * result in a peer dependency warning if the user doesn't bump the peer
 * dependency for some reason.
 *
 * Thanks to Mateusz Burzyński for the original script
 * Copyright (c) 2015 David Khourshid, MIT License
 * @see https://github.com/statelyai/xstate/blob/fb4786b80786d8ff3d44dfa818097b219dab623c/scripts/bump-peer-dep-ranges.js
 */
async function bumpPeerDepRanges() {
  let gitStatusResult = spawnSync("git", ["status", "--porcelain"]);
  if (gitStatusResult.status !== 0) {
    process.exit(gitStatusResult.status || undefined);
  }

  let allPackages = getPackagesSync(rootDir).packages;
  //   let pkgChanges = new Map(
  //     gitStatusResult.stdout
  //       .toString()
  //       .trim()
  //       .split("\n")
  //       .filter((line) => /^\s*M\s+.*\/package.json/.test(line))
  //       .map((line) => {
  //         /**
  //          * @type {string}
  //          * This will always be defined but TS doesn't know that
  //          * @ts-expect-error */
  //         let gitPath = line.match(/[^\s]+package.json/)[0];
  //         let fsPath = path.join(rootDir, gitPath);
  //         let packageJson = JSON.parse(fs.readFileSync(fsPath, "utf-8"));
  //         let previousPackageJsonResult = spawnSync("git", [
  //           "show",
  //           `HEAD:${gitPath}`,
  //         ]);

  //         if (previousPackageJsonResult.status !== 0) {
  //           process.exit(gitStatusResult.status || undefined);
  //         }

  //         return [
  //           packageJson.name,
  //           {
  //             path: fsPath,
  //             packageJson: packageJson,
  //             versionChanged:
  //               packageJson.version !==
  //               JSON.parse(previousPackageJsonResult.stdout.toString().trim())
  //                 .version,
  //           },
  //         ];
  //       })
  //   );

  for (let pkg of allPackages) {
    let peerPkg = pkg.packageJson.name;
    let peerPkgVersion = pkg.packageJson.version;
    // let peerPkgChange = pkgChanges.get(peerPkg);
    // if (!peerPkgChange || !peerPkgChange.versionChanged) {
    //   continue;
    // }

    for (let dependentPkg of allPackages) {
      let peerDeps = dependentPkg.packageJson.peerDependencies;
      if (!peerDeps || !peerDeps[peerPkg]) {
        continue;
      }
      let pkgJsonCopy = { ...dependentPkg.packageJson };
      // TS not smart enough to realize we checked this before copying the object
      // @ts-expect-error
      pkgJsonCopy.peerDependencies[peerPkg] = `^${peerPkgVersion}`;

      await fs.promises.writeFile(
        path.join(dependentPkg.dir, "package.json"),
        JSON.stringify(pkgJsonCopy, null, 2) + "\n",
        "utf-8"
      );
    }
  }
}

async function writeRemixChangelog() {
  let contents =
    "# `remix`\n\nSee the `CHANGELOG.md` in individual Remix packages for all changes.\n";
  let filePath = path.join(rootDir, "packages", "remix", "CHANGELOG.md");
  return fs.promises.writeFile(filePath, contents, "utf-8");
}
