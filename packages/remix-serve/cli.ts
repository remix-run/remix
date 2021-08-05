import path from "path";

import { createApp } from "./index";

let port = process.env.PORT || 3000;
let buildDirArg = process.argv[2];

if (!buildDirArg) {
  console.error(`
  Usage: remix-serve <build-dir>`);
  process.exit(1);
}

let buildDir = path.resolve(process.cwd(), buildDirArg);

createApp({ buildDir }).listen(port, () => {
  console.log(`Remix App Server started at http://localhost:${port}`);
});
