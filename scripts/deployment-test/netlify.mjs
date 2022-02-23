import path from "path";
import { spawnSync } from "child_process";
import { NetlifyAPI } from "netlify";
import fse from "fs-extra";
import { createApp } from "create-remix";

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

let APP_NAME = getAppName("netlify");
let PROJECT_DIR = getAppDirectory(APP_NAME);
let CYPRESS_DEV_URL = "http://localhost:3000";

async function createNewApp() {
  await createApp({
    install: false,
    lang: "ts",
    server: "netlify",
    projectDir: PROJECT_DIR,
    quiet: true,
  });
}

let client = new NetlifyAPI(process.env.NETLIFY_AUTH_TOKEN);

function createNetlifySite() {
  return client.createSite({
    body: {
      name: APP_NAME,
    },
  });
}

try {
  await createNewApp();

  // validate dependencies are available
  await validatePackageVersions(PROJECT_DIR);

  await Promise.all([
    fse.copy(CYPRESS_SOURCE_DIR, path.join(PROJECT_DIR, "cypress")),
    fse.copy(CYPRESS_CONFIG, path.join(PROJECT_DIR, "cypress.json")),
    addCypress(PROJECT_DIR, CYPRESS_DEV_URL),
  ]);

  let spawnOpts = getSpawnOpts(PROJECT_DIR);
  spawnSync("npm", ["install"], spawnOpts);
  spawnSync("npm", ["run", "build"], spawnOpts);

  // run the tests against the dev server
  runCypress(PROJECT_DIR, true, CYPRESS_DEV_URL);

  // create a new site on netlify
  let site = await createNetlifySite();
  console.log("Site created");

  // deploy to netlify
  let netlifyDeployCommand = spawnSync(
    "npx",
    ["netlify-cli", "deploy", "--site", site.id, "--prod"],
    spawnOpts
  );
  if (netlifyDeployCommand.status !== 0) {
    throw new Error("Netlify deploy failed");
  }

  console.log(`Deployed to ${site.ssl_url}`);

  runCypress(PROJECT_DIR, false, site.ssl_url);

  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
