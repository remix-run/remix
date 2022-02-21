import * as fsp from "fs/promises";
import * as path from "path";

import type { BuildMode } from "./build";

// Import environment variables from: .env(.development|.production|.local),
// failing gracefully if the file does not exist
export async function loadEnv(
  rootDirectory: string,
  suffix?: BuildMode | "local"
): Promise<void> {
  const envFile = `.env${suffix ? `.${suffix}` : ""}`;
  const envPath = path.join(rootDirectory, envFile);
  try {
    await fsp.readFile(envPath);
  } catch (e) {
    // Fail gracefully if file doesn't exist
    return;
  }

  console.log(`Loading environment variables from: ${envFile}`);
  const result = require("dotenv").config({ path: envPath });
  if (result.error) {
    throw result.error;
  }
}
