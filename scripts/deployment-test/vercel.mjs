import path from "path";
import { sync as spawnSync } from "cross-spawn";
import fse from "fs-extra";
import fetch from "node-fetch";
import { createApp } from "@remix-run/dev";

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

let APP_NAME = getAppName("vercel");
let PROJECT_DIR = getAppDirectory(APP_NAME);
let CYPRESS_DEV_URL = "http://localhost:3000";

async function createNewApp() {
  await createApp({
    appTemplate: "vercel",
    installDeps: false,
    useTypeScript: true,
    projectDir: PROJECT_DIR,
  });
}

function vercelClient(input, init) {
  let url = new URL(input, "https://api.vercel.com");
  let opts = {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
    },
  };

  return fetch(url, opts);
}

async function createVercelProject() {
  let response = await vercelClient(`/v9/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: APP_NAME }),
  });

  if (response.status !== 200) {
    throw new Error(`Error creating project: ${response.status}`);
  }

  let project = await response.json();
  return project;
}

async function getVercelDeploymentUrl(projectId) {
  let response = await vercelClient(`/v8/projects/${projectId}`);

  if (response.status !== 200) {
    throw new Error(`Error fetching project: ${response.status}`);
  }

  let project = await response.json();

  return project.targets?.production?.url;
}

async function destroyApp() {
  console.log(`Destroying app ${APP_NAME}`);
  let response = await vercelClient(`/v9/projects/${APP_NAME}`, {
    method: "DELETE",
  });
  if (response.status !== 200) {
    console.error(`Error destroying project ${APP_NAME}: ${response.status}`);
  } else {
    console.log(`Destroyed app ${APP_NAME}`);
  }
}

async function createAndDeployApp() {
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

  runCypress(PROJECT_DIR, true, CYPRESS_DEV_URL);

  // create a new project on vercel
  let project = await createVercelProject();
  console.log("Project created");

  // deploy to vercel
  let vercelDeployCommand = spawnSync(
    "npx",
    ["vercel", "deploy", "--prod", "--token", process.env.VERCEL_TOKEN],
    {
      ...spawnOpts,
      env: {
        ...process.env,
        VERCEL_PROJECT_ID: project.id,
      },
    }
  );
  if (vercelDeployCommand.status !== 0) {
    throw new Error("Vercel deploy failed");
  }

  let url = await getVercelDeploymentUrl(project.id);

  if (!url) {
    throw new Error("No deployment url found");
  }

  let fullUrl = `https://${url}`;

  console.log(`Deployed to ${fullUrl}`);

  // run cypress against the deployed app
  runCypress(PROJECT_DIR, false, fullUrl);
}

createAndDeployApp()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(destroyApp);
