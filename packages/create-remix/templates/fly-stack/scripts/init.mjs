import fs from "fs/promises";
import path from "path";
import { spawnSync } from "child_process";
import crypto from "crypto";
import toml from "@iarna/toml";

const PROJECT_DIR = process.cwd();
const THIS_FILE_PATH = path.join(PROJECT_DIR, "scripts/init.mjs");
const README_PATH = path.join(PROJECT_DIR, "README.md");
const PKG_JSON_PATH = path.join(PROJECT_DIR, "package.json");
const FLY_TOML_PRODUCTION_PATH = path.join(PROJECT_DIR, "fly.production.toml");
const FLY_TOML_STAGING_PATH = path.join(PROJECT_DIR, "fly.staging.toml");
const REPLACER = "[YOUR_APP_NAME]";

const DIR_NAME = path.basename(path.resolve(PROJECT_DIR));
const SUFFIX = crypto.randomBytes(2).toString("hex");
const APP_NAME = DIR_NAME + "-" + SUFFIX;

function escapeRegExp(string) {
  // $& means the whole matched string
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function main() {
  const [prodContent, stagingContent, readme, pkgJSONContent] =
    await Promise.all([
      fs.readFile(FLY_TOML_PRODUCTION_PATH, "utf-8"),
      fs.readFile(FLY_TOML_STAGING_PATH, "utf-8"),
      fs.readFile(README_PATH, "utf-8"),
      fs.readFile(PKG_JSON_PATH, "utf-8")
    ]);

  const prodToml = toml.parse(prodContent);
  const stagingToml = toml.parse(stagingContent);
  prodToml.app = prodToml.app.replace(REPLACER, APP_NAME);
  stagingToml.app = stagingToml.app.replace(REPLACER, APP_NAME);

  const newReadme = readme.replace(
    new RegExp(escapeRegExp(REPLACER), "g"),
    APP_NAME
  );

  const pkgJSON = JSON.parse(pkgJSONContent);

  pkgJSON.devDependencies = Object.fromEntries(
    Object.entries(pkgJSON.devDependencies).filter(
      ([key]) => !["@iarna/toml"].includes(key)
    )
  );

  await Promise.all([
    fs.writeFile(FLY_TOML_PRODUCTION_PATH, toml.stringify(prodToml)),
    fs.writeFile(FLY_TOML_STAGING_PATH, toml.stringify(stagingToml)),
    fs.writeFile(README_PATH, newReadme),
    fs.writeFile(PKG_JSON_PATH, JSON.stringify(pkgJSON, null, 2))
  ]);

  spawnSync("npm", ["install"], {
    cwd: PROJECT_DIR,
    stdio: "inherit"
  });

  await fs.rm(THIS_FILE_PATH);
}

try {
  await main();
  process.exit(1);
} catch (error) {
  console.error(error);
  process.exit(1);
}
