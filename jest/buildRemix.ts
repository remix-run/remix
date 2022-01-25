import * as path from "path";
import * as childProcess from "child_process";

function buildRemix(dir) {
  return new Promise((accept, reject) => {
    childProcess
      .spawn("yarn", ["build"], {
        stdio: "inherit",
        cwd: dir
      })
      .on("error", reject)
      .on("close", accept);
  });
}

export default async function () {
  let rootDir = path.dirname(__dirname);
  await buildRemix(rootDir);
}
