import path from "path";
import { spawnSync } from "child_process";
import aws from "aws-sdk";
import fse from "fs-extra";
import arcParser from "@architect/parser";
import { toLogicalID } from "@architect/utils";

import {
  sha,
  updatePackageConfig,
  spawnOpts,
  runCypress,
  addCypress
} from "./_shared.mjs";
import { createApp } from "../../build/node_modules/create-remix/index.js";

let APP_NAME = `remix-arc-${sha}`;
let AWS_STACK_NAME = toLogicalID(APP_NAME) + "Staging";
let PROJECT_DIR = path.join(process.cwd(), "deployment-test", APP_NAME);
let ARC_CONFIG_PATH = path.join(PROJECT_DIR, "app.arc");
let CYPRESS_DEV_URL = "http://localhost:3333";

async function createNewApp() {
  await createApp({
    install: false,
    lang: "ts",
    server: "arc",
    projectDir: PROJECT_DIR
  });
}

let client = new aws.ApiGatewayV2({
  region: "us-west-2",
  apiVersion: "latest",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function getArcDeployment() {
  let deployments = await client.getApis().promise();
  return deployments.Items.find(item => item.Name === AWS_STACK_NAME);
}

try {
  await createNewApp();

  await fse.copy(
    path.join(process.cwd(), "scripts/deployment-test/cypress"),
    path.join(PROJECT_DIR, "cypress")
  );

  await fse.copy(
    path.join(process.cwd(), "scripts/deployment-test/cypress.json"),
    path.join(PROJECT_DIR, "cypress.json")
  );

  await addCypress(PROJECT_DIR, CYPRESS_DEV_URL);

  await updatePackageConfig(PROJECT_DIR, config => {
    config.devDependencies["@architect/architect"] = "latest";
  });

  // change to the project directory
  process.chdir(PROJECT_DIR);

  // install deps
  spawnSync("npm", ["install"], spawnOpts);
  spawnSync("npm", ["run", "build"], spawnOpts);

  // run cypress against the dev server
  runCypress(true, CYPRESS_DEV_URL);

  // update our app.arc deployment name
  let fileContents = await fse.readFile(ARC_CONFIG_PATH);
  let parsed = arcParser(fileContents);
  parsed.app = [APP_NAME];
  await fse.writeFile(ARC_CONFIG_PATH, arcParser.stringify(parsed));

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
  runCypress(false, deployment.ApiEndpoint);

  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
