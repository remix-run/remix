import fse from "fs-extra";
import path from "path";
import type { ChildProcess } from "child_process";
import { spawn } from "child_process";
import setupPuppeteer from "jest-environment-puppeteer/setup";

export const TMP_DIR = path.join(process.cwd(), ".tmp", "integration");

// TODO: get rid of React Router `console.warn` when no routes match when testing
console.warn = () => {};

export default async function setup(globalConfig: any) {
  await setupPuppeteer(globalConfig);
  await fse.emptyDir(TMP_DIR);
  await installDeps(path.join(__dirname, "integration-template"));

  await setupGistsApp();
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

// when the gists app is removed, remove this as well:
async function setupGistsApp() {
  function runBuild(dir: string): Promise<void> {
    return new Promise((accept, reject) => {
      spawn("npm", ["run", "build"], {
        cwd: dir,
        stdio: "inherit",
      })
        .on("error", reject)
        .on("close", () => {
          accept();
        });
    });
  }

  async function startServer(dir: string): Promise<ChildProcess> {
    return new Promise((accept) => {
      let proc = spawn("npm", ["start"], {
        cwd: dir,
        stdio: "inherit",
      });

      // Give the server some time to be ready.
      setTimeout(() => {
        accept(proc);
      }, 2000);
    });
  }

  let rootDir = path.join(__dirname, "../gists-app");
  await installDeps(rootDir);
  await runBuild(rootDir);

  // @ts-ignore
  global.testServerProc = await startServer(rootDir);
}
