import path from "node:path";
import { sync as spawnSync } from "cross-spawn";
import fse from "fs-extra";
import { fetch } from "@remix-run/web-fetch";
import PackageJson from "@npmcli/package-json";

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

async function createAndDeployApp() {
  // create a new remix app
  spawnSync(
    "npx",
    [
      "--yes",
      "create-remix@latest",
      PROJECT_DIR,
      "--template",
      "cloudflare-pages",
      "--no-install",
      "--typescript",
    ],
    getSpawnOpts()
  );

  // validate dependencies are available
  let [valid, errors] = await validatePackageVersions(PROJECT_DIR);

  if (!valid) {
    console.error(errors);
    process.exit(1);
  }

  let pkgJson = await PackageJson.load(PROJECT_DIR);
  pkgJson.update({
    devDependencies: {
      ...pkgJson.content.devDependencies,
      wrangler: "latest",
    },
  });

  // add cypress to the project
  await Promise.all([
    fse.copy(CYPRESS_SOURCE_DIR, path.join(PROJECT_DIR, "cypress")),
    fse.copy(CYPRESS_CONFIG, path.join(PROJECT_DIR, "cypress.json")),
    addCypress(PROJECT_DIR, CYPRESS_DEV_URL),
    pkgJson.save(),
  ]);

  let spawnOpts = getSpawnOpts(PROJECT_DIR, {
    // these would usually be here by default, but I'd rather be explicit, so there is no spreading internally
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_GLOBAL_API_KEY: process.env.CLOUDFLARE_GLOBAL_API_KEY,
    CLOUDFLARE_EMAIL: process.env.CLOUDFLARE_EMAIL,
  });

  // install deps
  spawnSync("npm", ["install"], spawnOpts);
  spawnSync("npm", ["run", "build"], spawnOpts);

  // run cypress against the dev server
  runCypress(PROJECT_DIR, true, CYPRESS_DEV_URL);

  let createCommand = spawnSync(
    `npx`,
    [
      "wrangler",
      "pages",
      "project",
      "create",
      APP_NAME,
      "--production-branch",
      "main",
    ],
    spawnOpts
  );

  if (createCommand.status !== 0) {
    console.error(createCommand.error);
    throw new Error("Cloudflare Pages project creation failed");
  }

  let deployCommand = spawnSync(
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
  if (deployCommand.status !== 0) {
    console.error(deployCommand.error);
    throw new Error("Cloudflare Pages deploy failed");
  }

  console.log("Successfully created Cloudflare Pages project");

  let appUrl = `https://${APP_NAME}.pages.dev`;

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

async function main() {
  let exitCode;
  try {
    await createAndDeployApp();
    exitCode = 0;
  } catch (error) {
    console.error(error);
    exitCode = 1;
  } finally {
    await destroyApp();
    process.exit(exitCode);
  }
}

main();
