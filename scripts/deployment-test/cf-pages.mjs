import path from "path";
import { execSync, spawnSync } from "child_process";
import { Octokit } from "@octokit/rest";
import fse from "fs-extra";
import fetch from "node-fetch";
import { createApp } from "@remix-run/dev";
import retry from "retry";

import {
  addCypress,
  checkUrl,
  CYPRESS_CONFIG,
  CYPRESS_SOURCE_DIR,
  getAppDirectory,
  getAppName,
  getSpawnOpts,
  runCypress,
  validatePackageVersions,
} from "./_shared.mjs";

let APP_NAME = getAppName("cf-pages");
let PROJECT_DIR = getAppDirectory(APP_NAME);
let CYPRESS_DEV_URL = "http://localhost:8788";

async function createNewApp() {
  await createApp({
    appTemplate: "cloudflare-pages",
    installDeps: false,
    useTypeScript: true,
    projectDir: PROJECT_DIR,
  });
}

async function createCloudflareProject() {
  let promise = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/pages/projects`,
    {
      method: "POST",
      headers: {
        "X-Auth-Email": process.env.CF_EMAIL,
        "X-Auth-Key": process.env.CF_GLOBAL_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: APP_NAME,
        source: {
          type: "github",
          config: {
            owner: "remixautomatedtests",
            repo_name: APP_NAME,
            production_branch: "main",
            pr_comments_enabled: true,
            deployments_enabled: true,
          },
        },
        build_config: {
          build_command: "npm run build",
          destination_dir: "public",
          root_dir: "",
          fast_builds: true,
        },
      }),
    }
  );

  if (!promise.ok) {
    if (promise.headers.get("Content-Type").includes("application/json")) {
      console.error(await promise.json());
    }
    throw new Error(`Failed to create Cloudflare Pages project`);
  }
}

async function createCloudflareDeployment() {
  let promise = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/pages/projects/${APP_NAME}/deployments`,
    {
      method: "POST",
      headers: {
        "X-Auth-Email": process.env.CF_EMAIL,
        "X-Auth-Key": process.env.CF_GLOBAL_API_KEY,
      },
    }
  );

  if (!promise.ok) {
    if (promise.headers.get("Content-Type").includes("application/json")) {
      console.error(await promise.json());
    }
    throw new Error(`Failed to create Cloudflare Pages project`);
  }

  let deployment = await promise.json();

  return deployment.result.id;
}

function checkDeploymentStatus() {
  let operation = retry.operation({ retries: 20 });
  let url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/pages/projects/${APP_NAME}/deployments`;

  return new Promise((resolve, reject) => {
    operation.attempt(async (currentAttempt) => {
      console.log(`Checking deployment status; attempt ${currentAttempt}`);
      let response = await fetch(url, {
        headers: {
          "X-Auth-Email": process.env.CF_EMAIL,
          "X-Auth-Key": process.env.CF_GLOBAL_API_KEY,
        },
      });

      if (response.status >= 200 && response.status < 400) {
        let data = await response.json();
        let deployment = data.result[0];
        let latest = deployment.latest_stage;
        if (latest.name === "deploy" && latest.status === "success") {
          resolve("Pages deployed successfully");
        } else {
          let message = `Deployment not complete; latest stage: ${latest.name}/${latest.status}`;
          console.error(message);
          operation.retry(new Error(message));
        }
      } else {
        let message = `URL responded with status ${response.status}`;
        console.error(message);
        operation.retry(new Error(message));
      }
    });
  });
}

let octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function createRepoIfNeeded() {
  let repo = await octokit.repos.createForAuthenticatedUser({ name: APP_NAME });
  return repo.data;
}

let currentGitUser = {};

try {
  currentGitUser = {
    email: execSync("git config --get user.email").toString().trim(),
    name: execSync("git config --get user.name").toString().trim(),
  };
} catch {
  // git user not set
}

let spawnOpts = getSpawnOpts(PROJECT_DIR);

try {
  // create a new remix app
  await createNewApp();

  // validate dependencies are available
  await validatePackageVersions(PROJECT_DIR);

  // add cypress to the project
  await Promise.all([
    fse.copy(CYPRESS_SOURCE_DIR, path.join(PROJECT_DIR, "cypress")),

    fse.copy(CYPRESS_CONFIG, path.join(PROJECT_DIR, "cypress.json")),

    addCypress(PROJECT_DIR, CYPRESS_DEV_URL),
  ]);

  // install deps
  spawnSync("npm", ["install"], spawnOpts);
  spawnSync("npm", ["run", "build"], spawnOpts);

  // run cypress against the dev server
  runCypress(PROJECT_DIR, true, CYPRESS_DEV_URL);

  // create a new github repo
  let repo = await createRepoIfNeeded(APP_NAME);

  spawnSync("git", ["init"], spawnOpts);
  spawnSync(
    "git",
    ["config", "--global", "user.email", "hello@remix.run"],
    spawnOpts
  );
  spawnSync(
    "git",
    ["config", "--global", "user.name", "Remix Run Bot"],
    spawnOpts
  );
  spawnSync("git", ["branch", "-m", "main"], spawnOpts);
  spawnSync("git", ["add", "."], spawnOpts);
  spawnSync("git", ["commit", "-m", "initial commit"], spawnOpts);
  spawnSync(
    "git",
    [
      "remote",
      "add",
      "origin",
      `https://${process.env.GITHUB_TOKEN}@github.com/${repo.full_name}.git`,
    ],
    spawnOpts
  );
  spawnSync("git", ["push", "origin", "main"], spawnOpts);

  await createCloudflareProject();
  await createCloudflareDeployment();
  console.log("Successfully created Cloudflare Pages project");

  // wait for deployment to complete
  await checkDeploymentStatus();

  let appUrl = `https://${APP_NAME}.pages.dev`;

  await checkUrl(appUrl);

  // run cypress against the Cloudflare Pages server
  runCypress(PROJECT_DIR, false, appUrl);

  if (currentGitUser.email && currentGitUser.name) {
    spawnSync(
      "git",
      ["config", "--global", "user.email", currentGitUser.email],
      spawnOpts
    );
    spawnSync(
      "git",
      ["config", "--global", "user.name", currentGitUser.name],
      spawnOpts
    );
  }

  process.exit(0);
} catch (error) {
  if (currentGitUser.email && currentGitUser.name) {
    spawnSync(
      "git",
      ["config", "--global", "user.email", currentGitUser.email],
      spawnOpts
    );
    spawnSync(
      "git",
      ["config", "--global", "user.name", currentGitUser.name],
      spawnOpts
    );
  }

  console.error(error);
  process.exit(1);
}
