import * as fse from "fs-extra";
import * as path from "path";

// Import environment variables from: .env, failing gracefully if it doesn't exist
export async function loadEnv(rootDirectory: string): Promise<void> {
  let envPath = path.join(rootDirectory, ".env");
  try {
    await fse.readFile(envPath);
  } catch {
    return;
  }

  console.log(`Loading environment variables from .env`);
  let result = require("dotenv").config({ path: envPath });
  if (result.error) {
    throw result.error;
  }
}
