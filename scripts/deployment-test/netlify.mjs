import { execSync, spawnSync } from "child_process";
import path from "path";
import https from "https";
import { NetlifyAPI } from "netlify";

console.log("TEST_NETLIFY_TOKEN", process.env.TEST_NETLIFY_TOKEN);
process.env.NETLIFY_AUTH_TOKEN = process.env.TEST_NETLIFY_TOKEN;
let client = new NetlifyAPI(process.env.TEST_NETLIFY_TOKEN);

async function createSite() {
  let sha = execSync("git rev-parse HEAD").toString().trim().slice(0, 7);
  console.log(`SHA: ${sha}`);
  let site = await client.createSite({
    body: {
      name: `remix-prerelease-deployment-test-${Date.now()}`
    }
  });

  return site;
}

async function deploySite(site) {
  let currentDir = process.cwd();
  let exampleDir = path.join(
    process.cwd(),
    "./examples/netlify-prerelease-deployment-test"
  );
  process.chdir(exampleDir);

  spawnSync(
    "npx",
    ["npx", "--yes", "netlify-cli", "deploy", "--site", site.id, "--prod"],
    { stdio: "inherit" }
  );

  process.chdir(currentDir);
}

function getStatusCode(url) {
  return new Promise(resolve => {
    https.get(url, response => {
      resolve(response.statusCode);
    });
  });
}

async function verifySite(url) {
  let statusCode = await getStatusCode(url);
  if (statusCode !== 200) {
    throw new Error(`Site verification failed. Status code: ${statusCode}`);
  } else {
    console.log(`Site verification passed. Status code: ${statusCode}`);
  }
}

async function netlifyDeploymentTest() {
  let site = await createSite();
  console.log(`Site created: ${site.id}`);
  await deploySite(site);
  console.log(`Deployed to ${site.ssl_url}`);
  await verifySite(site.ssl_url);
}

try {
  await netlifyDeploymentTest();
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
