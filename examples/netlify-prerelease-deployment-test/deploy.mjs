import { execSync, spawnSync } from "child_process";
import https from "https";
import { NetlifyAPI } from "netlify";

process.env.NETLIFY_AUTH_TOKEN = process.env.TEST_NETLIFY_TOKEN;
const client = new NetlifyAPI(process.env.TEST_NETLIFY_TOKEN);

async function createSite() {
  const sha = execSync("git rev-parse HEAD").toString().trim().slice(0, 7);
  console.log(`SHA: ${sha}`);
  const site = await client.createSite({
    body: {
      name: `remix-prerelease-deployment-test-${Date.now()}`
    }
  });

  return site;
}

function getStatusCode(url) {
  return new Promise(resolve => {
    https.get(url, response => {
      resolve(response.statusCode);
    });
  });
}

async function verifySite(url) {
  const statusCode = await getStatusCode(url);
  if (statusCode !== 200) {
    throw new Error(`Site verification failed. Status code: ${statusCode}`);
  } else {
    console.log(`Site verification passed. Status code: ${statusCode}`);
  }
}

async function netlifyDeploymentTest() {
  const site = await createSite();
  console.log(`Site created: ${site.id}`);

  spawnSync(
    "npx",
    ["npx", "--yes", "netlify-cli", "deploy", "--site", site.id, "--prod"],
    { stdio: "inherit" }
  );

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
