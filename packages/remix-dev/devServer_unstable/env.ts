import fse from "fs-extra";
import * as path from "node:path";

// Import environment variables from: .env, failing gracefully if it doesn't exist
export async function loadEnv(rootDirectory: string): Promise<void> {
  let envPath = path.join(rootDirectory, ".env");
  if (!fse.existsSync(envPath)) return;

  let dotenvExpand = require('dotenv-expand');
  let result = require("dotenv").config({ path: envPath });
  dotenvExpand.expand(result)
  
  if (result.error) throw result.error;
}
