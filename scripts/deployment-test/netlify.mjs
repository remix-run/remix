import path from "path";
import { spawnSync } from "child_process";
import { NetlifyAPI } from "netlify";
import jsonfile from "jsonfile";
import fse from "fs-extra";

import { sha, updatePackageConfig, spawnOpts } from "./_shared.mjs";
import { createApp } from "../../build/node_modules/create-remix/index.js";

let APP_NAME = `remix-netlify-${sha}`;
let PROJECT_DIR = path.join(process.cwd(), "deployment-test", APP_NAME);

async function createNewNetlifyApp() {
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
  let rootPkgJson = await jsonfile.readFile(
    path.join(process.cwd(), "package.json")
  );

  await createNewNetlifyApp();

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
    config.devDependencies["@testing-library/cypress"] =
      rootPkgJson.dependencies["@testing-library/cypress"];

    config.scripts["cy:run"] = "cypress run";
    config.scripts["cy:open"] = "cypress open";
    config.scripts[
      "test:e2e:dev"
    ] = `start-server-and-test dev http://localhost:3000 cy:open`;
    config.scripts[
      "test:e2e:run"
    ] = `start-server-and-test dev http://localhost:3000 cy:run`;
  });

  process.chdir(PROJECT_DIR);
  spawnSync("npm", ["install"], spawnOpts);
  spawnSync("npm", ["run", "build"], spawnOpts);

  // run the tests against the dev server
  let cypressDevCommand = spawnSync("npm", ["run", "test:e2e:run"], {
    ...spawnOpts,
    env: { ...process.env, CYPRESS_BASE_URL: `http://localhost:3000` }
  });
  if (cypressDevCommand.status !== 0) {
    throw new Error("Cypress tests failed on dev server");
  }

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

  // run the tests against the deployed server
  let cypressProdCommand = spawnSync("npm", ["run", "cy:run"], {
    ...spawnOpts,
    env: { ...process.env, CYPRESS_BASE_URL: site.ssl_url }
  });
  if (cypressProdCommand.status !== 0) {
    throw new Error("Cypress tests failed on deployed server");
  }

  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
