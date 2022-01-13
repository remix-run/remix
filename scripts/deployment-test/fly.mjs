import path from "path";
import { spawnSync } from "child_process";
import fse from "fs-extra";
import fetch from "node-fetch";

import { sha, spawnOpts, runCypress, addCypress } from "./_shared.mjs";
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

async function getFlyAppUrl() {
  let promise = await fetch(`https://api.fly.io/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.FLY_TOKEN}`
    },
    body: JSON.stringify({
      operationName: "GET_FLY_APP",
      query: `
        query GET_FLY_APP {
          app(name: "remix-fly-app") {
            hostname
          }
        }
      `
    })
  });

  if (!promise.ok) {
    throw new Error(`Failed to get app url: ${promise.statusText}`);
  }

  let response = await promise.json();

  let { hostname } = response.data.app;
  return `https://${hostname}`;
}

try {
  // create a new remix app
  await createNewApp();

  // add cypress to the project
  // and a dockerfile
  await Promise.all([
    fse.copy(
      path.join(process.cwd(), "scripts/deployment-test/cypress"),
      path.join(PROJECT_DIR, "cypress")
    ),

    fse.copy(
      path.join(process.cwd(), "scripts/deployment-test/cypress.json"),
      path.join(PROJECT_DIR, "cypress.json")
    ),

    addCypress(PROJECT_DIR, CYPRESS_DEV_URL),

    fse.copy(
      path.join(process.cwd(), "scripts/deployment-test/fly-dockerfile"),
      path.join(PROJECT_DIR, "Dockerfile")
    )
  ]);

  // change to the project directory
  process.chdir(PROJECT_DIR);

  // create a new app on fly
  let flyLaunchCommand = spawnSync(
    "fly",
    [
      "launch",
      "--no-deploy",
      "--generate-name",
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

  // install deps
  spawnSync("npm", ["install"], spawnOpts);

  // run cypress against the dev server
  runCypress(true, CYPRESS_DEV_URL);

  // deploy to fly
  let flyDeployCommand = spawnSync("fly", ["deploy"], spawnOpts);
  if (flyDeployCommand.status !== 0) {
    throw new Error("Deployment failed");
  }

  // get the deployment url
  let url = await getFlyAppUrl();

  // run cypress against the deployed server
  runCypress(false, url);

  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
