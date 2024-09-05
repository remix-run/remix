import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import crypto from "node:crypto";
import { sync as spawnSync } from "cross-spawn";
import PackageJson from "@npmcli/package-json";
import jsonfile from "jsonfile";
import retry from "fetch-retry";
import { fetch } from "undici";

let fetchRetry = retry(fetch);

let __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getAppDirectory(name) {
  return path.join(__dirname, "apps", name);
}

export let CYPRESS_SOURCE_DIR = path.join(__dirname, "cypress");
export let CYPRESS_CONFIG = path.join(__dirname, "cypress.json");

export function getAppName(target) {
  let sha = execSync("git rev-parse HEAD").toString().trim().slice(0, 7);
  let suffix = crypto.randomBytes(4).toString("hex");
  return `remix-deployment-test-${target}-${sha}-${suffix}`;
}

export async function addCypress(directory, url) {
  let shared = await jsonfile.readFile(path.join(__dirname, "package.json"));
  let pkgJson = await PackageJson.load(directory);

  pkgJson.update({
    devDependencies: {
      ...pkgJson.content.devDependencies,
      "start-server-and-test": shared.dependencies["start-server-and-test"],
      cypress: shared.dependencies["cypress"],
      "@testing-library/cypress":
        shared.dependencies["@testing-library/cypress"],
    },
    scripts: {
      ...pkgJson.content.scripts,
      "cy:run": "cypress run",
      "cy:open": "cypress open",
      "test:e2e:dev": `start-server-and-test dev ${url} cy:open`,
      "test:e2e:run": `start-server-and-test dev ${url} cy:run`,
    },
  });

  await pkgJson.save();
}

export function getSpawnOpts(dir = __dirname, env = {}) {
  return {
    cwd: dir,
    stdio: "inherit",
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NODE_ENV: "development",
      ...env,
    },
  };
}

export function runCypress(dir, dev, url) {
  let spawnOpts = getSpawnOpts(dir, { CYPRESS_BASE_URL: url });

  if (dev) {
    let cypressDevCommand = spawnSync(
      "npm",
      ["run", "test:e2e:run"],
      spawnOpts
    );
    if (cypressDevCommand.status !== 0) {
      throw new Error("Cypress tests failed in development");
    }
  } else {
    let cypressProdCommand = spawnSync("npm", ["run", "cy:run"], spawnOpts);
    if (cypressProdCommand.status !== 0) {
      throw new Error("Cypress tests failed in production");
    }
  }
}

export function checkUrl(url) {
  let retries = 10;

  // exponential backoff for retries, maxes out at 10 seconds
  function wait(attempt) {
    return Math.min(Math.pow(2, attempt) * 250, 10_000); // 250, 500, 1000, 2000, 4000, 8000, 10000
  }

  return fetchRetry(url, {
    retryDelay: function (attempt, error, response) {
      return wait(attempt);
    },
    retryOn: (attempt, error, response) => {
      let currentAttempt = attempt + 1; // `attempt` is 0 based
      if (currentAttempt > retries) {
        console.log(`out of retries for ${url}`);
        return false;
      }

      if (error !== null || !response.ok) {
        console.log(
          `[${currentAttempt}/${retries}] - ${url} - waiting ${wait(attempt)}ms`
        );
        return true;
      }
    },
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

  let settled = await Promise.all(
    remixDeps.map(async (key) => {
      let version = allDeps[key];
      let pinnedVersion = version.replace(/^\^/, "");
      let url = `https://registry.npmjs.org/${key}/${pinnedVersion}`;
      let result = await checkUrl(url);
      return { ok: result.ok, url, status: result.status };
    })
  );

  let failed = settled.filter((result) => result.ok === false);

  if (failed.length > 0) {
    return [
      false,
      failed
        .map(
          (result) =>
            `${result.url} returned a ${result.status} HTTP status code`
        )
        .join("\n"),
    ];
  }

  return [true, null];
}
