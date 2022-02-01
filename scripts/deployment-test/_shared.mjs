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

export {
  sha,
  updatePackageConfig,
  getSpawnOpts,
  runCypress,
  addCypress,
  getRootPackageJson
};
