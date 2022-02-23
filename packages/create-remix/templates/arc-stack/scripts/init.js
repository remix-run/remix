const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

function getRandomString(length) {
  return crypto.randomBytes(length).toString("hex");
}

async function main(PROJECT_DIR) {
  const ENV_PATH = path.join(PROJECT_DIR, ".env");

  const env = `NODE_ENV="development"\nSESSION_SECRET="${getRandomString(16)}"`;

  await fs.writeFile(ENV_PATH, env);
}

module.exports = main;
