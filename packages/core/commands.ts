import { readConfig } from "./config";
import { BuildTarget, build, write } from "./compiler";
import { startAssetServer } from "./assetServer";

async function buildCommand(remixRoot: string) {
  console.log("Building Remix App...");

  let config = await readConfig(remixRoot);

  let [serverBuild, browserBuild] = await Promise.all([
    build(config, { target: BuildTarget.Server }),
    build(config, { target: BuildTarget.Browser })
  ]);

  await write(serverBuild, config);
  await write(browserBuild, config);

  console.log("done!");
}

export { buildCommand as build };

export async function run(remixRoot: string) {
  let config = await readConfig(remixRoot);

  startAssetServer(config, {
    onListen() {
      console.log(
        `Remix dev server running on port ${config.devServerPort}...`
      );
    },
    onReady() {
      console.log(`Remix dev server ready for requests!`);
    },
    onRebuild() {
      console.log(`Restarting the build...`);
    }
  });
}
