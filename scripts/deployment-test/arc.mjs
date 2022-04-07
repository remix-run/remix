import path from "path";
import { sync as spawnSync } from "cross-spawn";
import aws from "aws-sdk";
import fse from "fs-extra";
import arcParser from "@architect/parser";
import { toLogicalID } from "@architect/utils";
import { createApp } from "@remix-run/dev";

import {
  addCypress,
  CYPRESS_CONFIG,
  CYPRESS_SOURCE_DIR,
  getAppDirectory,
  getAppName,
  getSpawnOpts,
  runCypress,
  updatePackageConfig,
  validatePackageVersions,
} from "./_shared.mjs";

let APP_NAME = getAppName("arc");
let AWS_STACK_NAME = toLogicalID(APP_NAME) + "Staging";
let PROJECT_DIR = getAppDirectory(APP_NAME);
let ARC_CONFIG_PATH = path.join(PROJECT_DIR, "app.arc");
let CYPRESS_DEV_URL = "http://localhost:3333";

async function createNewApp() {
  await createApp({
    appTemplate: "arc",
    installDeps: false,
    useTypeScript: true,
    projectDir: PROJECT_DIR,
  });
}

let client = new aws.ApiGatewayV2({
  region: "us-west-2",
  apiVersion: "latest",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function deleteOldestDeployment() {
  let deployments = await client.getApis().promise();

  // Sort by creation date, oldest first
  let [deployment] = deployments.Items.sort((a, b) => {
    return a.CreatedDate > b.CreatedDate ? 1 : -1;
  });

  let arcName = deployment.Name.toLowerCase();
  let FAKE_PROJECT_DIR = getAppDirectory(arcName);
  let spawnOpts = getSpawnOpts(FAKE_PROJECT_DIR);

  console.log(`Deleting deployment ${arcName}`);
  // create a fake app.arc with the deployment name
  await fse.ensureDir(FAKE_PROJECT_DIR);
  await fse.writeFile(
    path.join(FAKE_PROJECT_DIR, "app.arc"),
    arcParser.stringify({ app: [arcName] })
  );
  let arcDestroyCommand = spawnSync(
    "npx",
    ["@architect/architect", "destroy", "--app", arcName, "--force"],
    spawnOpts
  );
  if (arcDestroyCommand.status !== 0) {
    console.log(arcDestroyCommand.error);
    throw new Error("🚨 Failed to destroy deployment");
  }

  await fse.rmdir(FAKE_PROJECT_DIR);
}

async function getArcDeployment() {
  let deployments = await client.getApis().promise();
  return deployments.Items.find((item) => item.Name === AWS_STACK_NAME);
}

try {
  await createNewApp();

  // validate dependencies are available
  await validatePackageVersions(PROJECT_DIR);

  await Promise.all([
    fse.copy(CYPRESS_SOURCE_DIR, path.join(PROJECT_DIR, "cypress")),
    fse.copy(CYPRESS_CONFIG, path.join(PROJECT_DIR, "cypress.json")),
    addCypress(PROJECT_DIR, CYPRESS_DEV_URL),
    updatePackageConfig(PROJECT_DIR, (config) => {
      config.devDependencies["@architect/architect"] = "latest";
    }),
  ]);

  let spawnOpts = getSpawnOpts(PROJECT_DIR);

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

  await deleteOldestDeployment();

  // deploy to the staging environment
  let arcDeployCommand = spawnSync(
    "npx",
    ["arc", "deploy", "--prune"],
    spawnOpts
  );
  if (arcDeployCommand.status !== 0) {
    throw new Error("Deployment failed");
  }

  let deployment = await getArcDeployment();
  if (!deployment) {
    throw new Error("Deployment not found");
  }

  // run cypress against the deployed server
  runCypress(PROJECT_DIR, false, deployment.ApiEndpoint);

  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
