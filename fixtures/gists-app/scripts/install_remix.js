#!/usr/bin/env node

const path = require("path");
const fs = require("fs-extra");

const buildDir = path.resolve(__dirname, "../../../build/node_modules");
const installDir = path.resolve(__dirname, "../node_modules");

async function run() {
  // Install all remix packages
  await fs.ensureDir(installDir);
  await fs.copy(buildDir, installDir);
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
