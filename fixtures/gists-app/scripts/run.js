const path = require("path");
const { run } = require("@remix-run/core");

let remixRoot = path.resolve(__dirname, "..");

run(remixRoot, {
  onListen: port => {
    console.log(`Remix fixture running on port ${port}`);
  },
  onRebuild() {
    console.log(`Remix restarting the build...`);
  },
  onReady() {
    console.log(`Remix server ready for requests!`);
  }
});
