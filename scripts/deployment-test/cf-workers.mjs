import path from "path";
import { sync as spawnSync } from "cross-spawn";
import fse from "fs-extra";
import toml from "@iarna/toml";
import { createApp } from "@remix-run/dev";

import {
  addCypress,
  CYPRESS_CONFIG,
  CYPRESS_SOURCE_DIR,
  getAppDirectory,
  getAppName,
  getSpawnOpts,
  runCypress,
  validatePackageVersions,
} from "./_shared.mjs";

let APP_NAME = getAppName("cf-workers");
let PROJECT_DIR = getAppDirectory(APP_NAME);
let CYPRESS_DEV_URL = "http://localhost:8787";

async function createNewApp() {
  await createApp({
    appTemplate: "cloudflare-workers",
    installDeps: false,
    useTypeScript: true,
    projectDir: PROJECT_DIR,
  });
}

async function createAndDeployApp() {
  // create a new remix app
  await createNewApp();

  // validate dependencies are available
  await validatePackageVersions(PROJECT_DIR);

  // add cypress to the project
  await Promise.all([
    fse.copy(CYPRESS_SOURCE_DIR, path.join(PROJECT_DIR, "cypress")),
    fse.copy(CYPRESS_CONFIG, path.join(PROJECT_DIR, "cypress.json")),
    addCypress(PROJECT_DIR, CYPRESS_DEV_URL),
  ]);

  let spawnOpts = getSpawnOpts(PROJECT_DIR);

  // install deps
  spawnSync("npm", ["install"], spawnOpts);
  spawnSync("npm", ["run", "build"], spawnOpts);

  // run cypress against the dev server
  runCypress(PROJECT_DIR, true, CYPRESS_DEV_URL);

  // we need to update the workers name
  let wranglerTomlPath = path.join(PROJECT_DIR, "wrangler.toml");
  let wranglerTomlContent = await fse.readFile(wranglerTomlPath);
  let wranglerToml = toml.parse(wranglerTomlContent);
  wranglerToml.name = APP_NAME;
  await fse.writeFile(wranglerTomlPath, toml.stringify(wranglerToml));
  let url = `https://${APP_NAME}.remix--run.workers.dev`;
  console.log(`worker url: ${url}`);

  // deploy the app
  let deployCommand = spawnSync("npx", ["wrangler", "publish"], spawnOpts);
  if (deployCommand.status !== 0) {
    throw new Error(`Failed to deploy app: ${deployCommand.stderr}`);
  }

  // run cypress against the deployed app
  runCypress(PROJECT_DIR, false, url);
}

async function destroyApp() {
  let result = await fetch(
    // using force will also delete bindings/durable objects
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${APP_NAME}?force=true`,
    {
      method: "DELETE",
      headers: {
        "X-Auth-Email": process.env.CLOUDFLARE_EMAIL,
        "X-Auth-Key": process.env.CLOUDFLARE_GLOBAL_API_KEY,
      },
    }
  );
  let json = await result.json();
  console.log(`[DESTROY_APP]`, json);
}

createAndDeployApp()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(destroyApp);
