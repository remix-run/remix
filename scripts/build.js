import { exec } from "./utils.js";

async function build() {
  await exec("tsc -b");

  await exec("mkdir -p build/@remix-run");

  await Promise.all([
    exec("cp -r .tsc-output/remix build/remix"),
    exec("cp -r .tsc-output/@remix-run-core build/@remix-run/core"),
    exec("cp -r .tsc-output/@remix-run-express build/@remix-run/express")
  ]);

  return 0;
}

build().then(code => {
  process.exit(code);
});
