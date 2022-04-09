import semver from "semver";
import NpmCliPackageJson from "@npmcli/package-json";
import { join } from "path";
import glob from "fast-glob";
import { maxBy } from "lodash";

import { readConfig } from "../../../../config";
import * as jscodeshift from "../../jscodeshift";
import type { MigrationFunction } from "../../types";
import { resolveTransformOptions } from "./resolveTransformOptions";
import type { Options } from "./transform";
import type { Dependency } from "./dependency";
import { depsToObject, isRemixPackage, depsToEntries } from "./dependency";
import { remixSetupPattern } from "./postinstall";

const TRANSFORM_PATH = join(__dirname, "transform");

const getRemixVersionSpec = (remixDeps: Dependency[]): string => {
  let candidate = maxBy(remixDeps, (dep) => semver.minVersion(dep.versionSpec));
  if (candidate === undefined) {
    console.error("TODO");
    process.exit(1);
  }

  let candidateMin = semver.minVersion(candidate.versionSpec);
  if (candidateMin === null) {
    console.error("TODO");
    process.exit(1);
  }
  return semver.lt(candidateMin, "1.3.3") ? "^1.3.3" : candidateMin.raw;
};

const shouldKeepPostinstall = (original?: string): boolean => {
  if (original === undefined) return false;

  let hasRemixSetup = new RegExp(remixSetupPattern).test(original);
  if (!hasRemixSetup) return true;

  let isOnlyRemixSetup = new RegExp(`^${remixSetupPattern}$`).test(original);
  if (isOnlyRemixSetup) return false;

  console.warn("TODO");
  return true;
};

export const replaceRemixImports: MigrationFunction = async ({
  projectDir,
  flags,
}) => {
  let pkg = await NpmCliPackageJson.load(projectDir);

  // 0. resolve runtime and adapter
  let { runtime, adapter } = await resolveTransformOptions(pkg.content);

  let deps = depsToEntries(pkg.content.dependencies);
  let remixDeps = deps.filter(({ name }) => isRemixPackage(name));
  let otherDeps = deps.filter(({ name }) => !isRemixPackage(name));
  let devDeps = depsToEntries(pkg.content.devDependencies);
  let remixDevDeps = devDeps.filter(({ name }) => isRemixPackage(name));
  let otherDevDeps = devDeps.filter(({ name }) => !isRemixPackage(name));

  // 1. upgrade Remix package, remove unused Remix packages
  let remixVersionSpec = getRemixVersionSpec([...remixDeps, ...remixDevDeps]);
  pkg.update({
    dependencies: {
      ...depsToObject(otherDeps),
      "@remix-run/react": remixVersionSpec,
      [`@remix-run/${runtime}`]: remixVersionSpec,
      ...(adapter ? { [`@remix-run/${adapter}`]: remixVersionSpec } : {}),
      // keep @remix-run/serve
      ...(remixDeps.map(({ name }) => name).includes("@remix-run/serve")
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
    },
  });

  // 2. Remove `remix setup` from postinstall
  if (!shouldKeepPostinstall(pkg.content.scripts?.postinstall)) {
    pkg.update({
      scripts: Object.fromEntries(
        Object.entries(pkg.content.scripts || {}).filter(
          ([script]) => script !== "postinstall"
        )
      ),
    });
  }

  // write updates to package.json
  await pkg.save();

  // 3. Run codemod
  let config = await readConfig(projectDir);
  let files = glob.sync("**/*.+(js|jsx|ts|tsx)", {
    cwd: config.appDirectory,
    absolute: true,
  });
  let codemodOk = jscodeshift.run<Options>({
    transformPath: TRANSFORM_PATH,
    files,
    flags,
    transformOptions: { runtime, adapter },
  });
};
