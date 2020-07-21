import { exec } from "child_process";
import { promisify } from "util";

const x = promisify(exec);

async function run() {
  await x("mkdir -p build/@remix-run");

  try {
    await x("tsc -b");
  } catch (error) {
    console.error(error.stdout);
    process.exit(1);
  }

  await x("cp -r .tsc-output/compiler build/@remix-run/compiler");
  await x(
    "cp packages/compiler/package.json build/@remix-run/compiler/package.json"
  );

  await x("cp -r .tsc-output/core build/@remix-run/core");
  await x("cp packages/core/package.json build/@remix-run/core/package.json");

  await x("cp -r .tsc-output/express build/@remix-run/express");
  await x(
    "cp packages/express/package.json build/@remix-run/express/package.json"
  );

  await x("cp -r .tsc-output/react build/@remix-run/react");
  await x("cp packages/react/package.json build/@remix-run/react/package.json");

  return 0;
}

run().then(
  code => {
    process.exit(code);
  },
  error => {
    console.error(error);
    process.exit(1);
  }
);
