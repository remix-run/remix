import { readConfig } from "./config";
import { startDevServer } from "./devServer";

export async function run(remixRoot: string) {
  let config = await readConfig(remixRoot);

  startDevServer(config, {
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
