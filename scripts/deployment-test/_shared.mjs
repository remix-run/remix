import path from "path";
import { execSync, spawnSync } from "child_process";
import jsonfile from "jsonfile";

let sha = execSync("git rev-parse HEAD").toString().trim().slice(0, 7);

async function updatePackageConfig(packageName, transform) {
  let file = path.join(packageName, "package.json");
  let json = await jsonfile.readFile(file);
  transform(json);
  await jsonfile.writeFile(file, json, { spaces: 2 });
}

let spawnOpts = { stdio: "inherit" };

function runCypress(dev, url) {
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

export { sha, updatePackageConfig, spawnOpts, runCypress };
