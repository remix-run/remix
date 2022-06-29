import path from "path";
import { sync as spawnSync } from "cross-spawn";
import fse from "fs-extra";
import fetch from "node-fetch";
import { createApp } from "@remix-run/dev";

import {
  addCypress,
  checkUrl,
  CYPRESS_CONFIG,
  CYPRESS_SOURCE_DIR,
  getAppDirectory,
  getAppName,
  getSpawnOpts,
  runCypress,
  validatePackageVersions,
} from "./_shared.mjs";

let APP_NAME = getAppName("cf-pages");
let PROJECT_DIR = getAppDirectory(APP_NAME);
let CYPRESS_DEV_URL = "http://localhost:8788";

async function createNewApp() {
  await createApp({
    appTemplate: "cloudflare-pages",
    installDeps: false,
    useTypeScript: true,
    projectDir: PROJECT_DIR,
  });
}

async function getDeploymentUrl() {
  let result = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/${APP_NAME}/deployments`,
    {
      headers: {
        "X-Auth-Email": process.env.CLOUDFLARE_EMAIL,
        "X-Auth-Key": process.env.CLOUDFLARE_GLOBAL_API_KEY,
      },
    }
  );

  let json = await result.json();

  let sorted = json.result.sort((a, b) => {
    return new Date(b.created_on) - new Date(a.created_on);
  });

  return sorted[0].url;
}

let spawnOpts = getSpawnOpts(PROJECT_DIR);

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

  // install deps
  spawnSync("npm", ["install"], spawnOpts);
  spawnSync("npm", ["run", "build"], spawnOpts);

  // run cypress against the dev server
  runCypress(PROJECT_DIR, true, CYPRESS_DEV_URL);

  let pagesDeployCommand = spawnSync(
    "npx",
    [
      "wrangler",
      "pages",
      "publish",
      "./public",
      "--project-name",
      APP_NAME,
      "--branch",
      "main",
    ],
    spawnOpts
  );
  if (pagesDeployCommand.status !== 0) {
    throw new Error("Cloudflare Pages deploy failed");
  }

  console.log("Successfully created Cloudflare Pages project");

  let appUrl = await getDeploymentUrl();

  await checkUrl(appUrl);

  // run cypress against the deployed app
  runCypress(PROJECT_DIR, false, appUrl);
}

async function destroyApp() {
  let result = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/${APP_NAME}`,
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
