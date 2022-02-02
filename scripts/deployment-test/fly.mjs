import path from "path";
import { spawnSync } from "child_process";
import fse from "fs-extra";
import toml from "@iarna/toml";

import { sha, getSpawnOpts, runCypress, addCypress } from "./_shared.mjs";
import { createApp } from "../../build/node_modules/create-remix/index.js";

let APP_NAME = `remix-fly-${sha}`;
let PROJECT_DIR = path.join(process.cwd(), "deployment-test", APP_NAME);
let CYPRESS_DEV_URL = "http://localhost:3000";

async function createNewApp() {
  await createApp({
    install: false,
    lang: "ts",
    server: "fly",
    projectDir: PROJECT_DIR
  });
}

try {
  // create a new remix app
  await createNewApp();

  // add cypress to the project
  await Promise.all([
    fse.copy(
      path.join(process.cwd(), "scripts/deployment-test/cypress"),
      path.join(PROJECT_DIR, "cypress")
    ),

    fse.copy(
      path.join(process.cwd(), "scripts/deployment-test/cypress.json"),
      path.join(PROJECT_DIR, "cypress.json")
    ),

    addCypress(PROJECT_DIR, CYPRESS_DEV_URL)
  ]);

  let spawnOpts = getSpawnOpts(PROJECT_DIR);

  // create a new app on fly
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
      "ord"
    ],
    spawnOpts
  );
  if (flyLaunchCommand.status !== 0) {
    throw new Error(`Failed to launch fly app: ${flyLaunchCommand.stderr}`);
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
  let flyDeployCommand = spawnSync("fly", ["deploy", "--remote-only"], spawnOpts);
  if (flyDeployCommand.status !== 0) {
    throw new Error("Deployment failed");
  }

  // fly deployments can take a sec to start
  // ... or a minute...
  // ... or a few minutes...
  console.log(`Fly app deployed, waiting for dns...`);
  await new Promise(resolve => setTimeout(() => resolve(), 60_000 * 5));

  // run cypress against the deployed server
  runCypress(PROJECT_DIR, false, flyUrl);

  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
