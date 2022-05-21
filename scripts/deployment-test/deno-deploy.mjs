import { sync as spawnSync } from "cross-spawn";
import { createApp } from "@remix-run/dev";

import {
  getAppDirectory,
  getAppName,
  getSpawnOpts,
  validatePackageVersions,
} from "./_shared.mjs";

let DENO_DEPLOY_PROJECT_NAME= "remix-deno-deploy-test"
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
  await validatePackageVersions(PROJECT_DIR);

  let spawnOpts = getSpawnOpts(PROJECT_DIR);

  // install deps
  spawnSync("npm", ["install"], spawnOpts);
  spawnSync("npm", ["run", "build"], spawnOpts);

  // deploy to deno deploy
  let deployCommand = spawnSync(
    "deployctl",
    ["deploy", "--prod", "--include=public,build", `--project=${DENO_DEPLOY_PROJECT_NAME}`, "./build/index.js"],
    spawnOpts
  );
  if (deployCommand.status !== 0) {
    throw new Error("Deploying to Deno Deploy failed");
  }

  console.log(`Deployed to ${DENO_DEPLOY_PROJECT_NAME}.deno.dev`);
} catch (error) {
  console.error(error);
  process.exit(1);
}