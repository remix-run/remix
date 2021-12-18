import "./env";
import path from "path";

import { createApp } from "./index";

const port = process.env.PORT || 3000;
const buildPathArg = process.argv[2];

if (!buildPathArg) {
  console.error(`
  Usage: remix-serve <build-dir>`);
  process.exit(1);
}

const buildPath = path.resolve(process.cwd(), buildPathArg);

createApp(buildPath).listen(port, () => {
  console.log(`Remix App Server started at http://localhost:${port}`);
});
