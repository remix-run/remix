let path = require("node:path");
let express = require("express");
let morgan = require("morgan");
let { createRequestHandler } = require("@remix-run/express");

const app = express();
app.use(express.static("public"));
app.use(morgan("tiny"));

const MODE = process.env.NODE_ENV;
const BUILD_DIR = path.join(process.cwd(), "build");

app.all(
  "*",
  MODE === "production"
    ? createRequestHandler({ build: require(BUILD_DIR) })
    : (...args) => {
        purgeRequireCache();
        let requestHandler = createRequestHandler({
          build: require(BUILD_DIR),
          mode: MODE,
        });
        return requestHandler(...args);
      }
);

async function go() {
  let { default: getPort, portNumbers } = await import("get-port");
  let port =
    process.env.PORT || (await getPort({ port: portNumbers(3000, 3100) }));
  app.listen(port, () => {
    // require the built app so we're ready when the first request comes in
    require(BUILD_DIR);
    console.log(`✅ app ready: http://localhost:${port}`);
  });
}

go();

function purgeRequireCache() {
  // this is how we can update the app without a full restart
  for (let key in require.cache) {
    if (
      key.startsWith(BUILD_DIR) ||
      key.includes("/@remix-run/") ||
      key.includes("/remix/")
    ) {
      delete require.cache[key];
    }
  }
}
