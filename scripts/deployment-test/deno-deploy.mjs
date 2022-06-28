import { sync as spawnSync } from "cross-spawn";
import { createApp } from "@remix-run/dev";

import {
  getAppDirectory,
  getAppName,
  getSpawnOpts,
  validatePackageVersions,
} from "./_shared.mjs";

let DENO_DEPLOY_PROJECT_NAME = "remix-deno-deploy-test";
let APP_NAME = getAppName(DENO_DEPLOY_PROJECT_NAME);
let PROJECT_DIR = getAppDirectory(APP_NAME);

async function createNewApp() {
  await createApp({
    appTemplate: "deno",
    installDeps: false,
    useTypeScript: true,
    projectDir: PROJECT_DIR,
  });
}

try {
  // create a new remix app
  await createNewApp();

  // validate dependencies are available
  let [valid, errors] = await validatePackageVersions(PROJECT_DIR);

  if (!valid) {
    console.error(errors);
    process.exit(1);
  }

  let spawnOpts = getSpawnOpts(PROJECT_DIR, {
    // these would usually be here by default, but I'd rather be explicit, so there is no spreading internally
    DENO_DEPLOY_TOKEN: process.env.DENO_DEPLOY_TOKEN,
  });

  // install deps
  spawnSync("npm", ["install"], spawnOpts);
  spawnSync("npm", ["run", "build"], spawnOpts);

  // deploy to deno deploy
  // note we dont have to install deployctl here as we do it ahead of time in the deployments workflow
  let deployCommand = spawnSync(
    "deployctl",
    [
      "deploy",
      "--project",
      DENO_DEPLOY_PROJECT_NAME,
      "./build/index.js",
      "--prod",
      "--include=build,public",
    ],
    spawnOpts
  );
  if (deployCommand.status !== 0) {
    console.error(deployCommand.error);
    throw new Error("Deno Deploy deploy failed");
  }

  console.log(`Deployed to ${DENO_DEPLOY_PROJECT_NAME}.deno.dev`);
} catch (error) {
  console.error(error);
  process.exit(1);
}
