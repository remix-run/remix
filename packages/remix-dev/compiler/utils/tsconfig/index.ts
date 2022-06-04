import tsConfigPaths from "tsconfig-paths";
import { promises as fsp } from "fs";
import * as path from "path";
import * as fse from "fs-extra";
import stripJsonComments from "strip-json-comments";

import { writeConfigDefaults } from "./write-config-defaults";

export function createMatchPath() {
  let configLoaderResult = tsConfigPaths.loadConfig();
  if (configLoaderResult.resultType === "failed") {
    if (configLoaderResult.message === "Missing baseUrl in compilerOptions") {
      throw new Error(
        `🚨 Oops! No baseUrl found, please set compilerOptions.baseUrl in your tsconfig or jsconfig`
      );
    }
    return undefined;
  }

  writeConfigDefaults(configLoaderResult.configFileAbsolutePath);

  return tsConfigPaths.createMatchPath(
    configLoaderResult.absoluteBaseUrl,
    configLoaderResult.paths,
    configLoaderResult.mainFields,
    configLoaderResult.addMatchAll
  );
}

/**
 * Reads the tsconfig.json file and parses the JSON
 * provided that it's an object.
 */
async function getTypeScriptConfig(rootDir: string): Promise<{
  compilerOptions?: {
    jsxImportSource?: string;
  };
} | null> {
  let tsconfigPath = path.resolve(rootDir, "tsconfig.json");
  let hasTsconfig = await fse.pathExists(tsconfigPath);

  if (!hasTsconfig) {
    return null;
  }

  let tsconfig = await fsp.readFile(tsconfigPath);

  let json: unknown = JSON.parse(stripJsonComments(tsconfig.toString()));

  if (typeof json !== "object" || json === null) {
    return null;
  }

  return json;
}

/**
 * Gets the potential `jsxImportSource` from tsconfig.json.
 */
export async function getJSXImportSource(
  rootDir: string
): Promise<string | null> {
  let tsconfig = await getTypeScriptConfig(rootDir);

  return tsconfig?.compilerOptions?.jsxImportSource ?? null;
}
