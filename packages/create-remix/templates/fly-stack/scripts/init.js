const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const toml = require("@iarna/toml");

function escapeRegExp(string) {
  // $& means the whole matched string
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getRandomString(length) {
  return crypto.randomBytes(length).toString("hex");
}

async function main(PROJECT_DIR) {
  let README_PATH = path.join(PROJECT_DIR, "README.md");
  let FLY_TOML_PROD_PATH = path.join(PROJECT_DIR, "fly.production.toml");
  let FLY_TOML_STAGING_PATH = path.join(PROJECT_DIR, "fly.staging.toml");
  let EXAMPLE_ENV_PATH = path.join(PROJECT_DIR, ".env.example");
  let ENV_PATH = path.join(PROJECT_DIR, ".env");

  let REPLACER = "[YOUR_APP_NAME]";

  let DIR_NAME = path.basename(path.resolve(PROJECT_DIR));
  let SUFFIX = getRandomString(2);
  let APP_NAME = DIR_NAME + "-" + SUFFIX;

  let [prodContent, stagingContent, readme, env] = await Promise.all([
    fs.readFile(FLY_TOML_PROD_PATH, "utf-8"),
    fs.readFile(FLY_TOML_STAGING_PATH, "utf-8"),
    fs.readFile(README_PATH, "utf-8"),
    fs.readFile(EXAMPLE_ENV_PATH, "utf-8"),
  ]);

  let newEnv = env + `\nSESSION_SECRET="${getRandomString(16)}"`;

  let prodToml = toml.parse(prodContent);
  let stagingToml = toml.parse(stagingContent);
  prodToml.app = prodToml.app.replace(REPLACER, APP_NAME);
  stagingToml.app = stagingToml.app.replace(REPLACER, APP_NAME);

  let newReadme = readme.replace(
    new RegExp(escapeRegExp(REPLACER), "g"),
    APP_NAME
  );

  await Promise.all([
    fs.writeFile(FLY_TOML_PROD_PATH, toml.stringify(prodToml)),
    fs.writeFile(FLY_TOML_STAGING_PATH, toml.stringify(stagingToml)),
    fs.writeFile(README_PATH, newReadme),
    fs.writeFile(ENV_PATH, newEnv),
  ]);
}

module.exports = main;
