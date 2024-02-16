import * as path from "node:path";
import { spawn } from "cross-spawn";

function buildRemix(dir) {
  return new Promise((accept, reject) => {
    spawn("pnpm", ["build"], {
      stdio: "inherit",
      cwd: dir,
    })
      .on("error", reject)
      .on("close", accept);
  });
}

export default async function () {
  let rootDir = path.dirname(__dirname);
  await buildRemix(rootDir);
}
