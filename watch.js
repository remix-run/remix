import path from "path";

import compiler from "./build/@remix-run/compiler/index.js";

compiler.watch(
  {
    mode: "development",
    outputDir: path.resolve(process.cwd(), "output"),
    sourceDir: path.resolve(process.cwd(), "server-src")
  },
  event => {
    console.log(event);
  }
);
