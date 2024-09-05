import path from "node:path";
import { sync as spawnSync } from "cross-spawn";
import fse from "fs-extra";
import toml from "@iarna/toml";

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

let APP_NAME = getAppName("fly");
let PROJECT_DIR = getAppDirectory(APP_NAME);
let CYPRESS_DEV_URL = "http://localhost:3000";

let spawnOpts = getSpawnOpts(PROJECT_DIR, {
  // these would usually be here by default, but I'd rather be explicit, so there is no spreading internally
  FLY_API_TOKEN: process.env.FLY_API_TOKEN,
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
      "fly",
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

  // add cypress to the project
  await Promise.all([
    fse.copy(CYPRESS_SOURCE_DIR, path.join(PROJECT_DIR, "cypress")),
    fse.copy(CYPRESS_CONFIG, path.join(PROJECT_DIR, "cypress.json")),
    addCypress(PROJECT_DIR, CYPRESS_DEV_URL),
  ]);

  // create a new app on fly
  // note we dont have to install fly here as we do it ahead of time in the deployments workflow
  let flyLaunchCommand = spawnSync(
    "flyctl",
    [
      "launch",
      "--name",
      APP_NAME,
      "--no-deploy",
      "--org",
      "personal",
      "--region",
      "ord",
    ],
    spawnOpts
  );
  if (flyLaunchCommand.status !== 0) {
    console.error(flyLaunchCommand.error);
    throw new Error("Failed to launch fly app");
  }

  // we need to add a PORT env variable to our fly.toml
  let flyTomlPath = path.join(PROJECT_DIR, "fly.toml");
  let flyTomlContent = await fse.readFile(flyTomlPath);
  let flyToml = toml.parse(flyTomlContent);
  flyToml.env = flyToml.env || {};
  flyToml.env.PORT = "8080";
  flyToml.services = flyToml.services || [];
  flyToml.services[0].internal_port = "8080";

  await fse.writeFile(flyTomlPath, toml.stringify(flyToml));
  let flyUrl = `https://${flyToml.app}.fly.dev`;
  console.log(`Fly app url: ${flyUrl}`);

  // install deps
  spawnSync("npm", ["install"], spawnOpts);

  // run cypress against the dev server
  runCypress(PROJECT_DIR, true, CYPRESS_DEV_URL);

  // deploy to fly
  let deployCommand = spawnSync("fly", ["deploy", "--remote-only"], spawnOpts);
  if (deployCommand.status !== 0) {
    console.error(deployCommand.error);
    throw new Error("Fly deploy failed");
  }

  // fly deployments can take a little bit to start receiving traffic
  console.log(`Fly app deployed, waiting for dns...`);
  await checkUrl(flyUrl);

  // run cypress against the deployed app
  runCypress(PROJECT_DIR, false, flyUrl);
}

function destroyApp() {
  spawnSync("fly", ["apps", "destroy", APP_NAME, "--yes"], spawnOpts);
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
