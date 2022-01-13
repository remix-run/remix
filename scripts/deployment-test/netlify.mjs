import path from "path";
import { spawnSync } from "child_process";
import { NetlifyAPI } from "netlify";
import fse from "fs-extra";

import { sha, spawnOpts, runCypress, addCypress } from "./_shared.mjs";
import { createApp } from "../../build/node_modules/create-remix/index.js";

let APP_NAME = `remix-netlify-${sha}`;
let PROJECT_DIR = path.join(process.cwd(), "deployment-test", APP_NAME);
let CYPRESS_DEV_URL = "http://localhost:3000";

async function createNewApp() {
  await createApp({
    install: false,
    lang: "ts",
    server: "netlify",
    projectDir: PROJECT_DIR
  });
}

let client = new NetlifyAPI(process.env.NETLIFY_AUTH_TOKEN);

function createNetlifySite() {
  return client.createSite({
    body: {
      name: APP_NAME
    }
  });
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

  process.chdir(PROJECT_DIR);
  spawnSync("npm", ["install"], spawnOpts);
  spawnSync("npm", ["run", "build"], spawnOpts);

  // run the tests against the dev server
  runCypress(true, CYPRESS_DEV_URL);

  // create a new site on netlify
  let site = await createNetlifySite();
  console.log("Site created");

  // deploy to netlify
  let netlifyDeployCommand = spawnSync(
    "npx",
    ["--yes", "netlify-cli", "deploy", "--site", site.id, "--prod"],
    spawnOpts
  );
  if (netlifyDeployCommand.status !== 0) {
    throw new Error("Netlify deploy failed");
  }

  console.log(`Deployed to ${site.ssl_url}`);

  runCypress(false, site.ssl_url);

  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
