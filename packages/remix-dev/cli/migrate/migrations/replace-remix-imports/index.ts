import { execSync } from "child_process";
import { join } from "path";
import NpmCliPackageJson from "@npmcli/package-json";
import glob from "fast-glob";
import { maxBy } from "lodash";
import semver from "semver";

import * as colors from "../../../../colors";
import { readConfig } from "../../../../config";
import { getPreferredPackageManager } from "../../../getPreferredPackageManager";
import * as jscodeshift from "../../jscodeshift";
import type { MigrationFunction } from "../../types";
import type { Dependency } from "./dependency";
import { depsToObject, isRemixPackage, depsToEntries } from "./dependency";
import { because, detected } from "./messages";
import {
  onlyRemixSetup,
  onlyRemixSetupRuntime,
  remixSetup,
} from "./remixSetup";
import { resolveTransformOptions } from "./resolveTransformOptions";
import type { Options } from "./transform/options";
import { CliError } from "../../../error";

const TRANSFORM_PATH = join(__dirname, "transform");

const getRemixVersionSpec = (remixDeps: Dependency[]): string => {
  let candidate = maxBy(remixDeps, (dep) => semver.minVersion(dep.versionSpec));
  if (candidate === undefined) {
    throw new CliError("❌ I couldn't find versions for your Remix packages.");
  }

  let candidateMin = semver.minVersion(candidate.versionSpec);
  if (candidateMin === null) {
    throw new CliError("❌ I couldn't find versions for your Remix packages.");
  }

  if (semver.lt(candidateMin, "1.3.3")) {
    console.log("⬆️  I'm upgrading your Remix dependencies");
    console.log(because("this migration requires v1.3.3 or newer."));

    return "^1.3.3";
  }

  console.log(
    detected(
      `\`${colors.blue(
        candidate.versionSpec
      )}\` as the best Remix version to use`
    )
  );
  console.log(because("you're already using a compatible Remix version."));
  return candidate.versionSpec;
};

const shouldKeepPostinstall = (original?: string): boolean => {
  if (original === undefined) {
    return false;
  }

  if (onlyRemixSetup.test(original) || onlyRemixSetupRuntime.test(original)) {
    console.log(
      "🗑  I'm removing `remix setup` from your `postinstall` script."
    );
    return false;
  }

  let hasRemixSetup = remixSetup.test(original);
  if (hasRemixSetup) {
    console.warn(
      "⚠️  I couldn't remove `remix setup` from your `postinstall script"
    );
    console.log(because("your `postinstall` script is too complex."));
    console.warn(
      "👉 You need to manually remove `remix setup` from your `postinstall` script."
    );
  }

  return true;
};

export const replaceRemixImports: MigrationFunction = async (
  projectDir,
  flags = {}
) => {
  let pkg = await NpmCliPackageJson.load(projectDir);

  // 0. resolve runtime and adapter
  let { adapter, runtime } = await resolveTransformOptions(pkg.content);

  let deps = depsToEntries(pkg.content.dependencies);
  let remixDeps = deps.filter(({ name }) => isRemixPackage(name));
  let otherDeps = deps.filter(({ name }) => !isRemixPackage(name));
  let devDeps = depsToEntries(pkg.content.devDependencies);
  let remixDevDeps = devDeps.filter(({ name }) => isRemixPackage(name));
  let otherDevDeps = devDeps.filter(({ name }) => !isRemixPackage(name));

  let remixServeInstalled = remixDeps
    .map(({ name }) => name)
    .includes("@remix-run/serve");
  if (remixServeInstalled) {
    let servePackage = colors.blue("@remix-run/serve");
    console.log(detected(`\`${servePackage}\` as your Remix server`));
    console.log(because("it is in your dependencies."));
  }

  // 1. upgrade Remix package, remove unused Remix packages
  console.log("\n💿 I'm checking your Remix dependencies");
  console.log(because("the `remix` package is deprecated."));
  let remixVersionSpec = getRemixVersionSpec([...remixDeps, ...remixDevDeps]);
  pkg.update({
    dependencies: {
      ...depsToObject(otherDeps),
      "@remix-run/react": remixVersionSpec,
      [`@remix-run/${runtime}`]: remixVersionSpec,
      ...(adapter ? { [`@remix-run/${adapter}`]: remixVersionSpec } : {}),
      ...(remixServeInstalled
        ? { [`@remix-run/serve`]: remixVersionSpec }
        : {}),
    },
    devDependencies: {
      ...depsToObject(otherDevDeps),
      ...depsToObject(
        remixDevDeps.map(({ name }) => ({
          name,
          versionSpec: remixVersionSpec,
        }))
      ),
      [`@remix-run/dev`]: remixVersionSpec,
    },
  });
  console.log("✅ Your Remix dependencies look good!");

  // 2. Remove `remix setup` from postinstall
  console.log("\n💿 I'm checking your `package.json` scripts");
  console.log(because("calling `remix setup` in `postinstall` is deprecated."));
  if (!shouldKeepPostinstall(pkg.content.scripts?.postinstall)) {
    pkg.update({
      scripts: Object.fromEntries(
        Object.entries(pkg.content.scripts || {}).filter(
          ([script]) => script !== "postinstall"
        )
      ),
    });
  }
  console.log("✅ Your `package.json` scripts looks good!");

  // write updates to package.json
  await pkg.save();

  // 3. Update lockfile for new dependencies by reinstalling
  console.log("\n💿 I'm updating your lockfile");
  console.log(because("your dependencies changed."));
  let packageManager = getPreferredPackageManager();
  execSync(`${packageManager} install`, { cwd: projectDir, stdio: "inherit" });
  console.log("✅ Your lockfile looks good!");

  // 4. Run codemod
  console.log("\n💿 I'm replacing any `remix` imports");
  console.log(because("importing from `remix` is deprecated."));
  let config = await readConfig(projectDir);
  let files = glob.sync("**/*.+(js|jsx|ts|tsx)", {
    absolute: true,
    cwd: config.appDirectory,
  });
  let codemodOk = await jscodeshift.run<Options>({
    files,
    flags,
    transformOptions: { adapter, runtime },
    transformPath: TRANSFORM_PATH,
  });
  if (!codemodOk) {
    console.error("❌ I couldn't replace all of your `remix` imports.");
    if (!flags.debug) {
      console.log("👉 Try again with the `--debug` flag to see what failed.");
    }
    throw new CliError();
  }
  console.log("✅ Your Remix imports look good!");

  console.log("\n🚚 I've successfully migrated your project! 🎉");
};
