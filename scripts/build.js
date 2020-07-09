import { exec } from "./utils.js";

async function build() {
  await exec("tsc -b");

  await exec("mkdir -p build/@remix-run");

  await Promise.all([
    exec("cp -r .tsc-output/core build/@remix-run/core"),
    exec("cp packages/core/package.json build/@remix-run/core/package.json"),

    exec("cp -r .tsc-output/express build/@remix-run/express"),
    exec(
      "cp packages/express/package.json build/@remix-run/express/package.json"
    ),

    exec("cp -r .tsc-output/react build/@remix-run/react"),
    exec("cp packages/react/package.json build/@remix-run/react/package.json")
  ]);

  return 0;
}

build().then(code => {
  process.exit(code);
});
