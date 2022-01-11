import aws from "aws-sdk";
import { installGlobals } from "@remix-run/node";

installGlobals();

async function verifySite(url) {
  const promise = await fetch(url);
  if (promise.status !== 200) {
    throw new Error(`Site verification failed. Status code: ${promise.status}`);
  }
  console.log(`Site verification passed. Status code: ${promise.status}`);
}

const client = new aws.ApiGatewayV2({
  region: "us-east-1",
  apiVersion: "latest",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function arcDeploymentTest() {
  const deployments = await client.getApis().promise();
  const deployment = deployments.Items.find(
    item => item.Name === "ArcPrereleaseDeploymentTestProduction"
  );

  if (!deployment) {
    throw new Error("Deployment not found");
  }

  await verifySite(deployment.ApiEndpoint);
}

try {
  await arcDeploymentTest();
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
