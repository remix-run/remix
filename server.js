import path from "path";

import compiler from "./build/@remix-run/compiler/index.js";

// Ideas:
// - To get HMR working, we need to know about the relationships of
//   modules to each other in a graph on the server. We can build this
//   graph for all source modules each time the bundle is rebuilt.
// - Don't bundle npm deps in the dev server. Instead, serve them in
//   separate requests to e.g. /_npm/react.js as ES modules. This should
//   let the server boot more quickly because we don't have to bundle
//   npm dependencies.
// - In the production build, let Rollup's code splitting take care
//   of optimizing the bundles for us.

let server = compiler.createDevServer({
  // flattenWaterfall: true,
  sourceDir: path.resolve(process.cwd(), "server-src")
});

server.listen(3000, () => {
  console.log("Server listening on port 3000");
});
