import * as fse from "fs-extra";
import * as path from "path";

import type { Logger } from "../tux/logger";

// Import environment variables from: .env, failing gracefully if it doesn't exist
export async function loadEnv(
  rootDirectory: string,
  options: { logger: Logger }
): Promise<void> {
  let envPath = path.join(rootDirectory, ".env");
  if (!fse.existsSync(envPath)) return;

  options.logger.debug(`Loading environment variables from .env`);
  let result = require("dotenv").config({ path: envPath });
  if (result.error) throw result.error;
}
