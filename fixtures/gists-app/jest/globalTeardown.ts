import type { ChildProcess } from "child_process";

function stopServer(serverProc: ChildProcess): Promise<void> {
  return new Promise(accept => {
    serverProc.on("close", () => {
      accept();
    });

    serverProc.kill("SIGTERM");
  });
}

module.exports = async () => {
  // @ts-ignore
  await stopServer(global.testServerProc);
};
