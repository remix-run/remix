const path = require("path");
const cp = require("child_process");

function installDeps(dir) {
  return new Promise((accept, reject) => {
    cp.spawn("yarn", ["install"], {
      cwd: dir,
      stdio: "inherit"
    })
      .on("error", reject)
      .on("close", () => {
        accept();
      });
  });
}

function runBuild(dir) {
  return new Promise((accept, reject) => {
    cp.spawn("yarn", ["build"], {
      cwd: dir,
      stdio: "inherit"
    })
      .on("error", reject)
      .on("close", () => {
        accept();
      });
  });
}

async function startServer(dir) {
  return new Promise(accept => {
    let proc = cp.spawn("yarn", ["start"], {
      cwd: dir,
      stdio: "inherit"
    });

    // Give the server some time to be ready.
    setTimeout(() => {
      accept(proc);
    }, 200);
  });
}

module.exports = async () => {
  let rootDir = path.dirname(__dirname);
  await installDeps(rootDir);
  await runBuild(rootDir);
  global.testServerProc = await startServer(rootDir);
};
