import crypto from "crypto";
import dns from "dns/promises";
import https from "https";
import path from "path";
import { execSync, spawnSync } from "child_process";
import jsonfile from "jsonfile";

let sha = execSync("git rev-parse HEAD").toString().trim().slice(0, 7);

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

  await updatePackageConfig(directory, config => {
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
    stdio: "inherit"
  };
}

function runCypress(dir, dev, url) {
  let spawnOpts = getSpawnOpts(dir);
  let cypressSpawnOpts = {
    ...spawnOpts,
    env: { ...process.env, CYPRESS_BASE_URL: url }
  };
  if (dev) {
    // run the tests against the dev server
    let cypressDevCommand = spawnSync(
      "npm",
      ["run", "test:e2e:run"],
      cypressSpawnOpts
    );
    if (cypressDevCommand.status !== 0) {
      throw new Error("Cypress tests failed on dev server");
    }
  } else {
    // run the tests against the deployed server
    let cypressProdCommand = spawnSync(
      "npm",
      ["run", "cy:run"],
      cypressSpawnOpts
    );
    if (cypressProdCommand.status !== 0) {
      throw new Error("Cypress tests failed on deployed server");
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

        https.get(url, response => {
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
              `${url} returned a ${response.statusCode} status code`,
              `trying again in 10 seconds, `,
              statusCodeRetriesLeft + statusCodeRetriesLeft === 1
                ? "retry"
                : "retries" + " left"
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

function getAppName(target) {
  let unique = crypto.randomBytes(2).toString("hex");
  return `remix-${target}-${sha}-${unique}`;
}

export {
  updatePackageConfig,
  getSpawnOpts,
  runCypress,
  addCypress,
  getRootPackageJson,
  checkUp,
  getAppName
};
