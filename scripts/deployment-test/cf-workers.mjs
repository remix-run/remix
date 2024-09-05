import path from "node:path";
import { sync as spawnSync } from "cross-spawn";
import fse from "fs-extra";
import toml from "@iarna/toml";
import PackageJson from "@npmcli/package-json";
import { fetch } from "undici";

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

async function createAndDeployApp() {
  // create a new remix app
  spawnSync(
    "npx",
    [
      "--yes",
      "create-remix@latest",
      PROJECT_DIR,
      "--template",
      "cloudflare-workers",
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

  // we need to update the workers name
  let wranglerTomlPath = path.join(PROJECT_DIR, "wrangler.toml");
  let wranglerTomlContent = await fse.readFile(wranglerTomlPath);
  let wranglerToml = toml.parse(wranglerTomlContent);
  wranglerToml.name = APP_NAME;
  await fse.writeFile(wranglerTomlPath, toml.stringify(wranglerToml));
  let url = `https://${APP_NAME}.remixrun.workers.dev`;
  console.log(`worker url: ${url}`);

  spawnSync("npx", ["wrangler", "--version"], spawnOpts);

  // deploy the app
  let deployCommand = spawnSync("npx", ["wrangler", "publish"], spawnOpts);
  if (deployCommand.status !== 0) {
    console.error(deployCommand.error);
    throw new Error("Cloudflare Workers deploy failed");
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
