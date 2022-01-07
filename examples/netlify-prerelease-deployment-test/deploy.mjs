import { execSync, spawnSync } from "child_process";
import { NetlifyAPI } from "netlify";
import { installGlobals } from "@remix-run/node";

installGlobals();

const client = new NetlifyAPI(process.env.NETLIFY_AUTH_TOKEN);

async function createNetlifySite() {
  const sha = execSync("git rev-parse HEAD").toString().trim().slice(0, 7);
  console.log(`SHA: ${sha}`);
  const site = await client.createSite({
    body: {
      name: `remix-prerelease-deployment-test-${Date.now()}`
    }
  });

  return site;
}

async function verifySite(url) {
  const promise = await fetch(url);
  if (promise.status !== 200) {
    throw new Error(`Site verification failed. Status code: ${promise.status}`);
  }
  console.log(`Site verification passed. Status code: ${promise.status}`);
}

async function netlifyDeploymentTest() {
  const site = await createNetlifySite();
  console.log("Site created");

  spawnSync(
    "npx",
    ["--yes", "netlify-cli", "deploy", "--site", site.id, "--prod"],
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
