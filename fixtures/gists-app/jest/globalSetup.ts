import * as path from "path";
import type { ChildProcess } from "child_process";
import { spawn } from "child_process";

function installDeps(dir: string): Promise<void> {
  return new Promise((accept, reject) => {
    spawn("yarn", ["install"], {
      cwd: dir,
      stdio: "inherit"
    })
      .on("error", reject)
      .on("close", () => {
        accept();
      });
  });
}

function runBuild(dir: string): Promise<void> {
  return new Promise((accept, reject) => {
    spawn("yarn", ["build"], {
      cwd: dir,
      stdio: "inherit"
    })
      .on("error", reject)
      .on("close", () => {
        accept();
      });
  });
}

async function startServer(dir: string): Promise<ChildProcess> {
  return new Promise(accept => {
    let proc = spawn("yarn", ["start"], {
      cwd: dir,
      stdio: "inherit"
    });

    // Give the server some time to be ready.
    setTimeout(() => {
      accept(proc);
    }, 2000);
  });
}

export default async function () {
  let rootDir = path.dirname(__dirname);
  await installDeps(rootDir);
  await runBuild(rootDir);

  // @ts-ignore
  global.testServerProc = await startServer(rootDir);
}
