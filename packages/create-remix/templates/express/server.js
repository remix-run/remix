import path from "path";
import express from "express";
import compression from "compression";
import morgan from "morgan";
import { createRequestHandler } from "@remix-run/express";

import * as build from "@remix-run/dev/server-build";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const BROWSER_BUILD_DIR = "/build/";

const app = express();
app.use(compression());

// http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
app.disable("x-powered-by");

app.use(
  express.static("public", {
    setHeaders(res, pathname) {
      const relativePath = pathname.replace(PUBLIC_DIR, "");
      res.setHeader(
        "Cache-Control",
        relativePath.startsWith(BROWSER_BUILD_DIR)
          ? // Remix fingerprints its assets so we can cache forever
            "public, max-age=31536000, immutable"
          : // You may want to be more aggressive with this caching
            "public, max-age=3600"
      );
    }
  })
);

app.use(morgan("tiny"));
app.all("*", createRequestHandler({ build, mode: process.env.NODE_ENV }));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});
