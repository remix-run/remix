import * as path from "path";
import { spawn } from "cross-spawn";

function buildRemix(dir) {
  return new Promise((accept, reject) => {
    spawn("yarn", ["build"], {
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
