import path from "path";
import { sync as spawnSync } from "cross-spawn";
import fse from "fs-extra";
import fetch from "node-fetch";
import { createApp } from "@remix-run/dev";
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
    body: JSON.stringify({
      name: APP_NAME,
      // we need to manually specify, otherwise it will use "other" for deployments
      framework: "remix",
    }),
  });

  if (!response.ok) {
    throw new Error(`Error creating project: ${response.status}`);
  }

  let project = await response.json();
  return project;
}

async function getVercelDeploymentUrl(projectId) {
  let response = await vercelClient(`/v8/projects/${projectId}`);

  if (!response.ok) {
    throw new Error(`Error fetching project: ${response.status}`);
  }

  let project = await response.json();

  return project.targets?.production?.url;
}

let spawnOpts = getSpawnOpts(PROJECT_DIR, {
  // these would usually be here by default, but I'd rather be explicit, so there is no spreading internally
  VERCEL_TOKEN: process.env.VERCEL_TOKEN,
  VERCEL_ORG_ID: process.env.VERCEL_ORG_ID,
});

async function createAndDeployApp() {
  await createNewApp();

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
      vercel: "latest",
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

  runCypress(PROJECT_DIR, true, CYPRESS_DEV_URL);

  // create a new project on vercel
  let project = await createVercelProject();
  console.log("Project created");

  spawnOpts.env.VERCEL_PROJECT_ID = project.id;

  // deploy to vercel
  let deployCommand = spawnSync(
    "npx",
    ["vercel", "deploy", "--prod"],
    spawnOpts
  );
  if (deployCommand.status !== 0) {
    console.error(deployCommand.error);
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

async function destroyApp() {
  console.log(`Destroying app ${APP_NAME}`);
  let response = await vercelClient(`/v9/projects/${APP_NAME}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    console.error(`Error destroying project ${APP_NAME}: ${response.status}`);
  } else {
    console.log(`Destroyed app ${APP_NAME}`);
  }
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
