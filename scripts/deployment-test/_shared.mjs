import crypto from "crypto";
import dns from "dns/promises";
import https from "https";
import path from "path";
import { execSync, spawnSync } from "child_process";
import jsonfile from "jsonfile";
import fetch from "node-fetch";

let sha = execSync("git rev-parse HEAD").toString().trim().slice(0, 7);

function getAppName(target) {
  let unique = crypto.randomBytes(2).toString("hex");
  return `remix-${target}-${sha}-${unique}`;
}

async function updatePackageConfig(directory, transform) {
  let file = path.join(directory, "package.json");
  let json = await jsonfile.readFile(file);
  transform(json);
  await jsonfile.writeFile(file, json, { spaces: 2 });
}

async function getRootPackageJson() {
  return jsonfile.readFile(path.join(process.cwd(), "package.json"));
}

async function addCypress(directory, url) {
  let rootPkgJson = await getRootPackageJson();

  await updatePackageConfig(directory, (config) => {
    config.devDependencies["start-server-and-test"] =
      rootPkgJson.dependencies["start-server-and-test"];
    config.devDependencies["cypress"] = rootPkgJson.dependencies["cypress"];
    config.devDependencies["@testing-library/cypress"] =
      rootPkgJson.dependencies["@testing-library/cypress"];

    config.scripts["cy:run"] = "cypress run";
    config.scripts["cy:open"] = "cypress open";
    config.scripts["test:e2e:dev"] = `start-server-and-test dev ${url} cy:open`;
    config.scripts["test:e2e:run"] = `start-server-and-test dev ${url} cy:run`;
  });
}

function getSpawnOpts(dir) {
  return {
    cwd: dir,
    stdio: "inherit",
  };
}

function runCypress(dir, dev, url) {
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

async function checkUp(url) {
  let hostname = new URL(url).hostname;
  return new Promise(async (resolve, reject) => {
    let statusCodeRetriesLeft = 10;
    let dnsRetriesLeft = 10;

    async function check() {
      try {
        console.log(`Checking ${url}`);
        await dns.lookup(hostname);

        https.get(url, (response) => {
          if (response.statusCode === 200) {
            clearInterval(checker);
            console.log(`${url} returned a 200 status code`);
            resolve();
          } else {
            statusCodeRetriesLeft -= 1;
            if (statusCodeRetriesLeft === 0) {
              clearInterval(checker);
              reject(`${url} failed to return a 200 status code`);
            }

            console.log(
              `${url} returned a ${response.statusCode} status code trying again in 10 seconds,`,
              statusCodeRetriesLeft === 1
                ? `${statusCodeRetriesLeft} retry left`
                : `${statusCodeRetriesLeft} retries left`
            );
          }
        });

        clearInterval(checker);
        console.log(`${url} returned a 200 status code`);
        resolve();
      } catch (error) {
        dnsRetriesLeft -= 1;
        if (dnsRetriesLeft === 0) {
          clearInterval(checker);
          reject(`${url} failed to return a 200 status code`);
        }

        console.log(
          `Couldn't resolve ${url}, trying again in 10 seconds, ${dnsRetriesLeft} retries left`
        );
      }
    }

    await check();
    let checker = setInterval(() => check(), 10_000);
  });
}

async function verifyPackageIsAvailable(packageName, version) {
  return new Promise(async (resolve, reject) => {
    let retriesLeft = 4;

    async function check() {
      try {
        console.log(`checking ${packageName}@${version} is available`);
        let res = await fetch(
          `https://registry.npmjs.org/${packageName}/${version}`
        );
        if (res.status !== 200) {
          throw new Error(`${packageName}@${version} is not available`);
        }
        clearInterval(timerId);
        console.log(`${packageName}@${version} is available`);
        resolve();
      } catch (error) {
        retriesLeft -= 1;
        if (retriesLeft > 0) {
          console.error(
            `${packageName}@${version} is not available, retrying in 5 seconds, ${retriesLeft} ${
              retriesLeft === 1 ? "retry" : "retries"
            } left`
          );
        } else {
          clearInterval(timerId);
          console.error(`giving up`);
          reject();
        }
      }
    }

    let timerId = setInterval(() => check(), 5_000);
  });
}

async function validatePackageVersions(directory) {
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
      return verifyPackageIsAvailable(key, version);
    })
  );
}

export {
  addCypress,
  checkUp,
  getAppName,
  getRootPackageJson,
  getSpawnOpts,
  runCypress,
  updatePackageConfig,
  validatePackageVersions,
};
