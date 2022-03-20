import type { ChildProcess } from "child_process";
// @ts-expect-error
import teardownPuppeteer from "jest-environment-puppeteer/teardown";

function stopServer(serverProc: ChildProcess): Promise<void> {
  return new Promise((accept) => {
    serverProc.on("close", () => {
      accept();
    });

    serverProc.kill("SIGTERM");
  });
}

module.exports = async (globalConfig: any) => {
  // @ts-ignore
  await stopServer(global.testServerProc);
  await teardownPuppeteer(globalConfig);
};
