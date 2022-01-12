import path from "path";
import { spawnSync } from "child_process";
import aws from "aws-sdk";
import jsonfile from "jsonfile";
import fse from "fs-extra";
import arcParser from "@architect/parser";

import { date, sha, updatePackageConfig } from "./_shared.mjs";
import { createApp } from "../../build/node_modules/create-remix/index.js";

let APP_NAME = `arc-${sha}-${date}`;
let AWS_APP_NAME = `Arc${sha}${date}Staging`;
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
  const deployment = deployments.Items.find(item => item.Name === AWS_APP_NAME);

  if (!deployment) {
    throw new Error("Deployment not found");
  }

  return deployment;
}

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
  spawnSync("npm", ["install"], { stdio: "inherit" });
  spawnSync("npm", ["run", "build"], { stdio: "inherit" });

  // run the tests against the dev server
  process.env.CYPRESS_BASE_URL = `http://localhost:3333`;
  spawnSync("npm", ["run", "test:e2e:run"], { stdio: "inherit" });

  // update our app.arc deployment name
  let fileContents = await fse.readFile(ARC_CONFIG_PATH);
  let parsed = arcParser(fileContents);
  parsed.app = [APP_NAME];
  await fse.writeFile(ARC_CONFIG_PATH, arcParser.stringify(parsed));

  // deploy to the staging environment
  spawnSync("npx", ["arc", "deploy", "--prune"], { stdio: "inherit" });
  let deployment = await getArcDeployment();

  // run the tests against the deployed app
  process.env.CYPRESS_BASE_URL = deployment.ApiEndpoint;
  spawnSync("npm", ["run", "cy:run"], { stdio: "inherit" });

  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
