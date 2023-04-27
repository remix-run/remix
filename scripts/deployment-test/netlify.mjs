import path from "path";
import { sync as spawnSync } from "cross-spawn";
import { NetlifyAPI } from "netlify";
import fse from "fs-extra";
import PackageJson from "@npmcli/package-json";

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

let client = new NetlifyAPI(process.env.NETLIFY_AUTH_TOKEN);

function createNetlifySite() {
  return client.createSite({
    body: { name: APP_NAME },
  });
}

let spawnOpts = getSpawnOpts(PROJECT_DIR, {
  // these would usually be here by default, but I'd rather be explicit, so there is no spreading internally
  NETLIFY_AUTH_TOKEN: process.env.NETLIFY_AUTH_TOKEN,
});

async function createAndDeployApp() {
  // create a new remix app
  spawnSync(
    "npx",
    [
      "--yes",
      "create-remix@latest",
      PROJECT_DIR,
      "--template",
      "netlify",
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
      "netlify-cli": "latest",
    },
  });

  await Promise.all([
    fse.copy(CYPRESS_SOURCE_DIR, path.join(PROJECT_DIR, "cypress")),
    fse.copy(CYPRESS_CONFIG, path.join(PROJECT_DIR, "cypress.json")),
    addCypress(PROJECT_DIR, CYPRESS_DEV_URL),
    pkgJson.save(),
  ]);

  spawnSync("npm", ["install"], spawnOpts);
  spawnSync("npm", ["run", "build"], spawnOpts);

  // run the tests against the dev server
  runCypress(PROJECT_DIR, true, CYPRESS_DEV_URL);

  // create a new site on netlify
  let site = await createNetlifySite();
  console.log("Site created");

  // deploy to netlify
  let deployCommand = spawnSync(
    "npx",
    ["netlify", "deploy", "--site", site.id, "--prod", "--build"],
    spawnOpts
  );
  if (deployCommand.status !== 0) {
    console.error(deployCommand.error);
    throw new Error("Netlify deploy failed");
  }

  console.log(`Deployed to ${site.ssl_url}`);

  // run cypress against the deployed app
  runCypress(PROJECT_DIR, false, site.ssl_url);
}

async function destroyApp() {
  let sites = await client.listSites();
  let site = sites.find((site) => site.name === APP_NAME);
  if (!site) {
    throw new Error("No site found");
  }

  spawnSync(
    "npx",
    ["netlify", "sites:delete", site.site_id, "--force"],
    spawnOpts
  );
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
