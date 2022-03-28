import fs from "fs/promises";
import path from "path";

import {
  createFixtureProject,
  js
} from "./helpers/create-fixture";

describe("cloudflare compiler", () => {
  let projectDir: string;

  beforeAll(async () => {
    projectDir = await createFixtureProject({
      template: 'cloudflare-workers',
      files: {
        "app/routes/index.jsx": js`
          import fake from "worker-pkg";

          export default function Index() {
            return <div id="index">{fake}</div>
          }
        `,
        "node_modules/worker-pkg/package.json": `{
          "name": "worker-pkg",
          "version": "1.0.0",
          "type": "module",
          "main": "./default.js",
          "exports": {
            "worker": "./worker.js",
            "default": "./default.js"
          }
        }`,
        "node_modules/worker-pkg/worker.js": js`
          export default "__WORKER_EXPORTS_SHOULD_BE_IN_BUNDLE__";
        `,
        "node_modules/worker-pkg/default.js": js`
          export default "__DEFAULT_EXPORTS_SHOULD_NOT_BE_IN_BUNDLE__";
        `
      }
    });
  });

  it("bundles worker export of 3rd party package", async () => {
    let serverBundle = await fs.readFile(
      path.resolve(projectDir, "build/index.js"),
      "utf8"
    );

    expect(
      serverBundle.includes("__WORKER_EXPORTS_SHOULD_BE_IN_BUNDLE__")
    ).toBe(true);
    expect(
      serverBundle.includes("__DEFAULT_EXPORTS_SHOULD_NOT_BE_IN_BUNDLE__")
    ).toBe(false);
  });
});
