import { readFile } from "fs/promises";
import glob from "fast-glob";
import { join } from "path";
import type { PackageJson } from "type-fest";

import { JSCodeshiftTransform } from "../../jscodeshift";
import type { Transform } from "../types";
import { cleanupPackageJson } from "./cleanup-package-json";
import { getJSCodeshiftExtraOptions } from "./get-jscodeshift-extra-options";
import type { ExtraOptions } from "./jscodeshift-transform";

const transformPath = join(__dirname, "jscodeshift-transform");

export const updateRemixImports: Transform = async ({ projectDir, flags }) => {
  let pkgJsonPath = join(projectDir, "package.json");
  let packageJson: PackageJson = JSON.parse(
    await readFile(pkgJsonPath, "utf-8")
  );
  let extraOptions = getJSCodeshiftExtraOptions(packageJson);

  await cleanupPackageJson({
    content: packageJson,
    path: pkgJsonPath,
    runtime: extraOptions.runtime,
  });

  let files = glob.sync("**/*.+(js|jsx|ts|tsx)", {
    cwd: projectDir,
    absolute: true,
  });

  return JSCodeshiftTransform<ExtraOptions>({
    extraOptions,
    files,
    flags,
    transformPath,
  });
};
