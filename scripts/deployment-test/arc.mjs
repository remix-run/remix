import path from "node:path";
import { sync as spawnSync } from "cross-spawn";
import { ApiGatewayV2Client } from "@aws-sdk/client-apigatewayv2";
import fse from "fs-extra";
import arcParser from "@architect/parser";
import { toLogicalID } from "@architect/utils";
import destroy from "@architect/destroy";
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

let APP_NAME = getAppName("arc");
let AWS_STACK_NAME = toLogicalID(APP_NAME) + "Staging";
let PROJECT_DIR = getAppDirectory(APP_NAME);
let ARC_CONFIG_PATH = path.join(PROJECT_DIR, "app.arc");
let CYPRESS_DEV_URL = "http://localhost:3333";

/** @type {import('@aws-sdk/client-apigatewayv2').ApiGatewayV2ClientConfig} */
let options = {
  region: "us-west-2",
  apiVersion: "latest",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
};

let apiGateway = new ApiGatewayV2Client(options);

async function getArcDeployment() {
  let deployments = await apiGateway.getApis().promise();
  return deployments.Items.find((item) => item.Name === AWS_STACK_NAME);
}

async function createAndDeployApp() {
  // create a new remix app
  spawnSync(
    "npx",
    [
      "--yes",
      "create-remix@latest",
      PROJECT_DIR,
      "--template",
      "arc",
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
      "@architect/architect": "latest",
    },
  });

  await Promise.all([
    fse.copy(CYPRESS_SOURCE_DIR, path.join(PROJECT_DIR, "cypress")),
    fse.copy(CYPRESS_CONFIG, path.join(PROJECT_DIR, "cypress.json")),
    addCypress(PROJECT_DIR, CYPRESS_DEV_URL),
    pkgJson.save(),
  ]);

  let spawnOpts = getSpawnOpts(PROJECT_DIR, {
    // these would usually be here by default, but I'd rather be explicit, so there is no spreading internally
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  });

  // install deps
  spawnSync("npm", ["install"], spawnOpts);
  spawnSync("npm", ["run", "build"], spawnOpts);

  // run cypress against the dev server
  runCypress(PROJECT_DIR, true, CYPRESS_DEV_URL);

  // update our app.arc deployment name
  let fileContents = await fse.readFile(ARC_CONFIG_PATH);
  let parsed = arcParser(fileContents);
  parsed.app = [APP_NAME];
  await fse.writeFile(ARC_CONFIG_PATH, arcParser.stringify(parsed));

  // deploy to the staging environment
  let deployCommand = spawnSync("npx", ["arc", "deploy", "--prune"], spawnOpts);
  if (deployCommand.status !== 0) {
    console.error(deployCommand.error);
    throw new Error("Architect deploy failed");
  }

  let deployment = await getArcDeployment();
  if (!deployment) {
    throw new Error("Deployment not found");
  }

  // run cypress against the deployed app
  runCypress(PROJECT_DIR, false, deployment.ApiEndpoint);
}

async function destroyApp() {
  console.log(`Destroying app ${APP_NAME}`);

  try {
    process.env.AWS_REGION = options.region;
    await destroy({
      appname: APP_NAME,
      env: "staging",
      force: true,
    });
    console.log(`Destroyed app ${APP_NAME}`);
  } catch (error) {
    console.error(`Failed to destroy app ${APP_NAME}`);
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
