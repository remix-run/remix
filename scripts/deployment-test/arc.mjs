import path from "path";
import { spawnSync } from "child_process";
import aws from "aws-sdk";
import jsonfile from "jsonfile";
import fse from "fs-extra";
import arcParser from "@architect/parser";
import { toLogicalID } from "@architect/utils";

import { sha, updatePackageConfig } from "./_shared.mjs";
import { createApp } from "../../build/node_modules/create-remix/index.js";

let APP_NAME = `remix-deployment-test-${sha}`;
let AWS_STACK_NAME = toLogicalID(APP_NAME) + "Staging";
let PROJECT_DIR = path.join(process.cwd(), "deployment-test", APP_NAME);
let ARC_CONFIG_PATH = path.join(PROJECT_DIR, "app.arc");

async function createNewArcApp() {
  await createApp({
    install: false,
    lang: "ts",
    server: "arc",
    projectDir: PROJECT_DIR
  });
}

const client = new aws.ApiGatewayV2({
  region: "us-west-2",
  apiVersion: "latest",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function getArcDeployment() {
  const deployments = await client.getApis().promise();
  const deployment = deployments.Items.find(
    item => item.Name === AWS_STACK_NAME
  );

  return deployment;
}

let spawnOpts = { stdio: "inherit" };

try {
  let rootPkgJson = await jsonfile.readFile(
    path.join(process.cwd(), "package.json")
  );

  await createNewArcApp();

  await fse.copy(
    path.join(process.cwd(), "scripts/deployment-test/cypress"),
    path.join(PROJECT_DIR, "cypress")
  );

  await fse.copy(
    path.join(process.cwd(), "scripts/deployment-test/cypress.json"),
    path.join(PROJECT_DIR, "cypress.json")
  );

  await updatePackageConfig(PROJECT_DIR, config => {
    config.devDependencies["start-server-and-test"] =
      rootPkgJson.dependencies["start-server-and-test"];
    config.devDependencies["cypress"] = rootPkgJson.dependencies["cypress"];
    config.devDependencies["concurrently"] =
      rootPkgJson.dependencies["concurrently"];
    config.devDependencies["@testing-library/cypress"] =
      rootPkgJson.dependencies["@testing-library/cypress"];
    config.devDependencies["@architect/architect"] = "latest";

    config.scripts["dev:arc"] = "arc sandbox";
    config.scripts["dev:remix"] = "remix watch";
    config.scripts["dev"] =
      'concurrently "npm run dev:remix" "npm run dev:arc" --kill-others-on-fail';
    config.scripts["cy:run"] = "cypress run";
    config.scripts["cy:open"] = "cypress open";
    config.scripts[
      "test:e2e:dev"
    ] = `start-server-and-test dev http://localhost:3333 cy:open`;
    config.scripts[
      "test:e2e:run"
    ] = `start-server-and-test dev http://localhost:3333 cy:run`;
  });

  process.chdir(PROJECT_DIR);
  spawnSync("npm", ["install"], spawnOpts);
  spawnSync("npm", ["run", "build"], spawnOpts);

  // run the tests against the dev server
  process.env.CYPRESS_BASE_URL = `http://localhost:3333`;
  let cypressDevCommand = spawnSync("npm", ["run", "test:e2e:run"], spawnOpts);
  if (cypressDevCommand.status !== 0) {
    throw new Error("Cypress tests failed on dev server");
  }

  // update our app.arc deployment name
  let fileContents = await fse.readFile(ARC_CONFIG_PATH);
  let parsed = arcParser(fileContents);
  parsed.app = [APP_NAME];
  await fse.writeFile(ARC_CONFIG_PATH, arcParser.stringify(parsed));

  // deploy to the staging environment
  let arcDeployCommand = spawnSync("arc", ["deploy", "--prune"], spawnOpts);
  if (arcDeployCommand.status !== 0) {
    throw new Error("Deployment failed");
  }
  let deployment = await getArcDeployment();
  if (!deployment) {
    throw new Error("Deployment not found");
  }

  // run the tests against the deployed app
  process.env.CYPRESS_BASE_URL = deployment.ApiEndpoint;
  let cypressProdCommand = spawnSync("npm", ["run", "cy:run"], spawnOpts);
  if (cypressProdCommand.status !== 0) {
    throw new Error("Cypress tests failed on deployed app");
  }

  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
