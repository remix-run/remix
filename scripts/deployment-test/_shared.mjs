import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { execSync, spawnSync } from "child_process";
import jsonfile from "jsonfile";
import fetch from "node-fetch";
import semver from "semver";
import retry from "retry";

let __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getAppDirectory(name) {
  return path.join(__dirname, "apps", name);
}

export let CYPRESS_SOURCE_DIR = path.join(__dirname, "cypress");
export let CYPRESS_CONFIG = path.join(__dirname, "cypress.json");

export function getAppName(target) {
  let sha = execSync("git rev-parse HEAD").toString().trim().slice(0, 7);
  let unique = crypto.randomBytes(2).toString("hex");
  return `remix-${target}-${sha}-${unique}`;
}

export async function updatePackageConfig(directory, transform) {
  let file = path.join(directory, "package.json");
  let json = await jsonfile.readFile(file);
  transform(json);
  await jsonfile.writeFile(file, json, { spaces: 2 });
}

export async function addCypress(directory, url) {
  let shared = await jsonfile.readFile(path.join(__dirname, "package.json"));

  await updatePackageConfig(directory, (config) => {
    config.devDependencies["start-server-and-test"] =
      shared.dependencies["start-server-and-test"];
    config.devDependencies["cypress"] = shared.dependencies["cypress"];
    config.devDependencies["@testing-library/cypress"] =
      shared.dependencies["@testing-library/cypress"];

    config.scripts["cy:run"] = "cypress run";
    config.scripts["cy:open"] = "cypress open";
    config.scripts["test:e2e:dev"] = `start-server-and-test dev ${url} cy:open`;
    config.scripts["test:e2e:run"] = `start-server-and-test dev ${url} cy:run`;
  });
}

export function getSpawnOpts(dir) {
  return {
    cwd: dir,
    stdio: "inherit",
  };
}

export function runCypress(dir, dev, url) {
  let spawnOpts = getSpawnOpts(dir);
  let cypressSpawnOpts = {
    ...spawnOpts,
    env: { ...process.env, CYPRESS_BASE_URL: url },
  };
  if (dev) {
    let cypressDevCommand = spawnSync(
      "npm",
      ["run", "test:e2e:run"],
      cypressSpawnOpts
    );
    if (cypressDevCommand.status !== 0) {
      throw new Error("Cypress tests failed in development");
    }
  } else {
    let cypressProdCommand = spawnSync(
      "npm",
      ["run", "cy:run"],
      cypressSpawnOpts
    );
    if (cypressProdCommand.status !== 0) {
      throw new Error("Cypress tests failed in production");
    }
  }
}

export async function checkUrl(url) {
  let operation = retry.operation({ retries: 10 });

  return new Promise((resolve, reject) => {
    operation.attempt(async () => {
      try {
        let response = await fetch(url);
        if (response.status >= 200 && response.status < 400) {
          resolve("App server is up");
        } else {
          throw new Error(`App server is not up: ${response.status}`);
        }
      } catch (error) {
        reject(operation.retry(error));
      }
    });
  });
}

export async function validatePackageVersions(directory) {
  let packageJson = jsonfile.readFileSync(path.join(directory, "package.json"));
  let devDependencies = packageJson.devDependencies || {};
  let dependencies = packageJson.dependencies || {};
  let allDeps = { ...devDependencies, ...dependencies };
  let remixDeps = Object.keys(allDeps).filter((key) =>
    key.startsWith("@remix-run")
  );

  await Promise.all(
    remixDeps.map((key) => {
      let version = allDeps[key];
      return checkUrl(`https://registry.npmjs.org/${key}/${version}`);
    })
  );
}
