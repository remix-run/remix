function stopServer(serverProc) {
  return new Promise(accept => {
    serverProc.on("close", () => {
      accept();
    });

    serverProc.kill("SIGTERM");
  });
}

module.exports = async () => {
  await stopServer(global.testServerProc);
};
