import { promises as fsp } from "fs";
import * as path from "path";
// @ts-expect-error
import readPackageJson from "read-package-json-fast";

export async function writeFileSafe(
  file: string,
  contents: string
): Promise<void> {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, contents);
}

export async function createTemporaryDirectory(
  baseDir: string
): Promise<string> {
  return fsp.mkdtemp(path.join(baseDir, "remix-"));
}
