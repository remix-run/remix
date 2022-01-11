import { execSync, spawnSync } from "child_process";
import { installGlobals } from "@remix-run/node";

installGlobals();

async function createVercelProject() {
  const sha = execSync("git rev-parse HEAD").toString().trim().slice(0, 7);

  const promise = await fetch(`https://api.vercel.com/v8/projects`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      framework: "remix",
      name: `remix-prerelease-deployment-test-${sha}-${Date.now()}`
    })
  });

  if (promise.status !== 200) {
    throw new Error(`Error creating project: ${promise.status}`);
  }

  const project = await promise.json();
  return project;
}

async function vercelDeploymentTest() {
  const project = await createVercelProject();
  console.log("Project created");

  process.env.VERCEL_PROJECT_ID = project.id;

  spawnSync(
    "npx",
    [
      "--yes",
      "vercel",
      "deploy",
      "--prod",
      "--token",
      process.env.VERCEL_TOKEN
    ],
    { stdio: "inherit" }
  );

  const url = `https://${project.name}.vercel.app`;

  console.log(`Deployed to ${url}`);
  await verifySite(url);

  process.env.BASE_URL = url;

  spawnSync("npm", ["run", "cy:run"], { stdio: "inherit" });
}

async function verifySite(url) {
  const promise = await fetch(url);
  if (promise.status !== 200) {
    throw new Error(`Site verification failed. Status code: ${promise.status}`);
  }
  console.log(`Site verification passed. Status code: ${promise.status}`);
}

try {
  await vercelDeploymentTest();
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
