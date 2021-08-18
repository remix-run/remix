#!/usr/bin/env node

const path = require("path");
const fs = require("fs-extra");
const { execSync } = require("child_process");

let buildDir = path.resolve(__dirname, "../../../build/node_modules");
let installDir = path.resolve(__dirname, "../node_modules");

async function run() {
  // Install all remix packages
  await fs.ensureDir(installDir);
  await fs.copy(buildDir, installDir);

  // Manually run postinstall for node + react + server
  execSync("node node_modules/@remix-run/node/scripts/postinstall.js");
  execSync("node node_modules/@remix-run/react/scripts/postinstall.js");
  execSync("node node_modules/@remix-run/server-runtime/scripts/postinstall.js");
}

run().then(
  () => {
    process.exit(0);
  },
  error => {
    console.error(error);
    process.exit(1);
  }
);
