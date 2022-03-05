import { promises as fsp } from "fs";
import * as path from "path";
import * as fse from "fs-extra";

/**
 * Reads the tsconfig.json file and parses the JSON
 * provided that it's an object.
 */
async function getTypeScriptConfig(rootDir: string): Promise<{
  compilerOptions?: {
    jsxImportSource?: string;
  };
} | null> {
  let { default: stripJsonComments } = await import("strip-json-comments");

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
