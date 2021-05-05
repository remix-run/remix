import * as fs from "fs-extra";
import * as path from "path";

export async function installMagicExports(sourceDir: string): Promise<void> {
  let installDir = path.resolve(findClosestNodeModulesDir("remix"), "remix");
  await fs.copy(sourceDir, installDir);
}

function findClosestNodeModulesDir(packageName: string): string {
  let dir = path.dirname(require.resolve(packageName));

  while (path.basename(dir) !== "node_modules") {
    let prevDir = dir;
    dir = path.dirname(dir);
    if (prevDir === dir) {
      throw new Error("Cannot find node_modules dir");
    }
  }

  return dir;
}
