// This should eventually be a npm package, but for now it lives here.
// It's job is to notify the remix dev server of the version of the running
// app to trigger HMR / HDR.

import * as fs from "node:fs";
import * as path from "node:path";

import { logDevReady } from "@remix-run/node";

const buildPath = "server/index.mjs";

let lastTimeout;

export default {
  sandbox: {
    async watcher() {
      if (lastTimeout) {
        clearTimeout(lastTimeout);
      }

      lastTimeout = setTimeout(async () => {
        const contents = fs.readFileSync(
          path.resolve(process.cwd(), buildPath),
          "utf8"
        );
        const manifestMatches = contents.matchAll(/manifest-([A-f0-9]+)\.js/g);
        const sent = new Set();
        for (const match of manifestMatches) {
          const buildHash = match[1];
          if (!sent.has(buildHash)) {
            sent.add(buildHash);
            logDevReady({ assets: { version: buildHash } });
          }
        }
      }, 300);
    },
  },
  set: {
    env() {
      // Pass matching env variables through to the application in dev mode.
      const passthruKeys = /^NODE_ENV$|^REMIX_DEV_/;
      return {
        testing: Object.fromEntries(
          Object.entries(process.env).filter(([key]) => passthruKeys.test(key))
        ),
      };
    },
  },
};
