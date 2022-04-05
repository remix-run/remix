import fse from "fs-extra";
import path from "path";
import { spawn } from "child_process";

export const TMP_DIR = path.join(process.cwd(), ".tmp", "integration");

// TODO: get rid of React Router `console.warn` when no routes match when testing
console.warn = () => {};

export default async function setup(globalConfig: any) {
  await fse.emptyDir(TMP_DIR);
  await installDeps(path.join(__dirname, "integration-template"));
}

function installDeps(dir: string): Promise<void> {
  return new Promise((accept, reject) => {
    spawn("npm", ["install"], {
      cwd: dir,
      stdio: "inherit",
    })
      .on("error", reject)
      .on("close", () => {
        accept();
      });
  });
}
