import { constants, promises as fsp } from "fs";
import * as path from "path";

export function fileExists(file: string): Promise<boolean> {
  return fsp
    .access(file, constants.F_OK)
    .then(() => true)
    .catch(() => false);
}

export async function writeFileSafe(
  file: string,
  contents: string
): Promise<string> {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, contents);
  return file;
}

export async function writeFilesSafe(
  files: { file: string; contents: string }[]
): Promise<string[]> {
  return Promise.all(
    files.map(({ file, contents }) => writeFileSafe(file, contents))
  );
}

export async function createTemporaryDirectory(
  baseDir: string
): Promise<string> {
  return fsp.mkdtemp(path.join(baseDir, "remix-"));
}
