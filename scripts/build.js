import { exec } from "child_process";
import { promisify } from "util";

const x = promisify(exec);

async function run() {
  try {
    await x("tsc -b");
  } catch (error) {
    console.error(error.stdout);
    process.exit(1);
  }

  await x("cp packages/core/package.json build/@remix-run/core/package.json");

  await x(
    "cp packages/express/package.json build/@remix-run/express/package.json"
  );

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
