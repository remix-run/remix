function stopServer(serverProc) {
  return new Promise(accept => {
    serverProc.on("close", () => {
      accept();
    });

    serverProc.kill("SIGTERM");
  });
}

module.exports = async () => {
  delete process.env.REMIX_SERVER_TIMING;
  await stopServer(global.testServerProc);
};
