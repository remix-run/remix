import path from "path";

import compiler from "./build/@remix-run/compiler/index.js";

compiler
  .build({
    mode: "development",
    outputDir: path.resolve(process.cwd(), "output"),
    sourceDir: path.resolve(process.cwd(), "server-src")
  })
  .then(() => {
    process.exit();
  });
