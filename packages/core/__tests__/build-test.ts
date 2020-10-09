import path from "path";
import type { OutputAsset } from "rollup";

import type { BuildOptions } from "../compiler";
import { BuildMode, BuildTarget, build, generate } from "../compiler";
import type { RemixConfig } from "../config";
import { readConfig } from "../config";

async function generateBuild(config: RemixConfig, options: BuildOptions) {
  return await generate(await build(config, options));
}

const remixRoot = path.resolve(__dirname, "../../../fixtures/gists-app");

describe("building", () => {
  let config: RemixConfig;
  beforeAll(async () => {
    config = await readConfig(remixRoot);
  });

  describe("the development server build", () => {
    it("generates the correct bundles and manifest", async () => {
      let { output } = await generateBuild(config, {
        mode: BuildMode.Development,
        target: BuildTarget.Server
      });

      expect(output.map(item => item.fileName)).toMatchInlineSnapshot(`
        Array [
          "entry-server.js",
          "routes/404.js",
          "routes/500.js",
          "routes/gists.js",
          "routes/gists/$username.js",
          "routes/gists/index.js",
          "routes/gists.mine.js",
          "routes/index.js",
          "pages/one.js",
          "pages/two.js",
          "server-manifest.json",
        ]
      `);

      let manifest = output.find(
        item => item.fileName === "server-manifest.json"
      ) as OutputAsset;

      expect(JSON.parse(manifest.source as string)).toMatchInlineSnapshot(`
        Object {
          "entry-server": Object {
            "fileName": "entry-server.js",
            "imports": Array [
              "react",
              "react-dom/server",
              "@remix-run/core",
              "@remix-run/react/server",
              "@remix-run/react",
            ],
          },
          "pages/one": Object {
            "fileName": "pages/one.js",
            "imports": Array [
              "react",
              "@mdx-js/react",
            ],
          },
          "pages/two": Object {
            "fileName": "pages/two.js",
            "imports": Array [
              "@mdx-js/react",
            ],
          },
          "routes/404": Object {
            "fileName": "routes/404.js",
            "imports": Array [
              "react",
            ],
          },
          "routes/500": Object {
            "fileName": "routes/500.js",
            "imports": Array [
              "react",
            ],
          },
          "routes/gists": Object {
            "fileName": "routes/gists.js",
            "imports": Array [
              "react",
              "@remix-run/react",
              "react-router-dom",
            ],
          },
          "routes/gists.mine": Object {
            "fileName": "routes/gists.mine.js",
            "imports": Array [
              "react",
            ],
          },
          "routes/gists/$username": Object {
            "fileName": "routes/gists/$username.js",
            "imports": Array [
              "react",
              "@remix-run/react",
              "react-router-dom",
            ],
          },
          "routes/gists/index": Object {
            "fileName": "routes/gists/index.js",
            "imports": Array [
              "react",
              "@remix-run/react",
            ],
          },
          "routes/index": Object {
            "fileName": "routes/index.js",
            "imports": Array [
              "react",
              "@remix-run/react",
            ],
          },
        }
      `);
    });
  });

  describe("the production server build", () => {
    it("generates the correct bundles and manifest", async () => {
      let { output } = await generateBuild(config, {
        mode: BuildMode.Production,
        target: BuildTarget.Server
      });

      expect(output.map(item => item.fileName)).toMatchInlineSnapshot(`
        Array [
          "entry-server-ec81fe4f.js",
          "routes/404-660aace6.js",
          "routes/500-3568401c.js",
          "routes/gists-77c65246.js",
          "routes/gists/$username-6467bc2d.js",
          "routes/gists/index-eda98f93.js",
          "routes/gists.mine-9c786e2b.js",
          "routes/index-7c07748d.js",
          "pages/one-5a7ab0cd.js",
          "pages/two-7fb52f96.js",
          "_rollupPluginBabelHelpers-9bd7278f.js",
          "server-manifest.json",
        ]
      `);

      let manifest = output.find(
        item => item.fileName === "server-manifest.json"
      ) as OutputAsset;

      expect(JSON.parse(manifest.source as string)).toMatchInlineSnapshot(`
        Object {
          "entry-server": Object {
            "fileName": "entry-server-ec81fe4f.js",
            "imports": Array [
              "react",
              "react-dom/server",
              "@remix-run/core",
              "@remix-run/react/server",
              "@remix-run/react",
            ],
          },
          "pages/one": Object {
            "fileName": "pages/one-5a7ab0cd.js",
            "imports": Array [
              "react",
              "_rollupPluginBabelHelpers-9bd7278f.js",
              "@mdx-js/react",
            ],
          },
          "pages/two": Object {
            "fileName": "pages/two-7fb52f96.js",
            "imports": Array [
              "_rollupPluginBabelHelpers-9bd7278f.js",
              "@mdx-js/react",
            ],
          },
          "routes/404": Object {
            "fileName": "routes/404-660aace6.js",
            "imports": Array [
              "react",
            ],
          },
          "routes/500": Object {
            "fileName": "routes/500-3568401c.js",
            "imports": Array [
              "react",
            ],
          },
          "routes/gists": Object {
            "fileName": "routes/gists-77c65246.js",
            "imports": Array [
              "react",
              "@remix-run/react",
              "react-router-dom",
            ],
          },
          "routes/gists.mine": Object {
            "fileName": "routes/gists.mine-9c786e2b.js",
            "imports": Array [
              "react",
            ],
          },
          "routes/gists/$username": Object {
            "fileName": "routes/gists/$username-6467bc2d.js",
            "imports": Array [
              "react",
              "@remix-run/react",
              "react-router-dom",
            ],
          },
          "routes/gists/index": Object {
            "fileName": "routes/gists/index-eda98f93.js",
            "imports": Array [
              "react",
              "@remix-run/react",
            ],
          },
          "routes/index": Object {
            "fileName": "routes/index-7c07748d.js",
            "imports": Array [
              "react",
              "@remix-run/react",
            ],
          },
        }
      `);
    });
  });

  describe("the development browser build", () => {
    it("generates the correct bundles and manifest", async () => {
      let { output } = await generateBuild(config, {
        mode: BuildMode.Development,
        target: BuildTarget.Browser
      });

      expect(output.map(item => item.fileName)).toMatchInlineSnapshot(`
        Array [
          "entry-browser.js",
          "routes/404.js",
          "routes/500.js",
          "routes/gists.js",
          "routes/gists/$username.js",
          "routes/gists/index.js",
          "routes/gists.mine.js",
          "routes/index.js",
          "pages/one.js",
          "pages/two.js",
          "index-8737e582.js",
          "index-9cd505a2.js",
          "esm-fe9de3ed.js",
          "global.css",
          "routes/gists.css",
          "asset-manifest.json",
        ]
      `);

      let manifest = output.find(
        item => item.fileName === "asset-manifest.json"
      ) as OutputAsset;

      expect(JSON.parse(manifest.source as string)).toMatchInlineSnapshot(`
        Object {
          "entry-browser": Object {
            "fileName": "entry-browser.js",
            "imports": Array [
              "index-8737e582.js",
              "index-9cd505a2.js",
            ],
          },
          "global.css": Object {
            "fileName": "global.css",
          },
          "pages/one": Object {
            "fileName": "pages/one.js",
            "imports": Array [
              "index-8737e582.js",
              "esm-fe9de3ed.js",
            ],
          },
          "pages/two": Object {
            "fileName": "pages/two.js",
            "imports": Array [
              "index-8737e582.js",
              "esm-fe9de3ed.js",
            ],
          },
          "routes/404": Object {
            "fileName": "routes/404.js",
            "imports": Array [
              "index-8737e582.js",
            ],
          },
          "routes/500": Object {
            "fileName": "routes/500.js",
            "imports": Array [
              "index-8737e582.js",
            ],
          },
          "routes/gists": Object {
            "fileName": "routes/gists.js",
            "imports": Array [
              "index-8737e582.js",
              "index-9cd505a2.js",
            ],
          },
          "routes/gists.css": Object {
            "fileName": "routes/gists.css",
          },
          "routes/gists.mine": Object {
            "fileName": "routes/gists.mine.js",
            "imports": Array [
              "index-8737e582.js",
            ],
          },
          "routes/gists/$username": Object {
            "fileName": "routes/gists/$username.js",
            "imports": Array [
              "index-8737e582.js",
              "index-9cd505a2.js",
            ],
          },
          "routes/gists/index": Object {
            "fileName": "routes/gists/index.js",
            "imports": Array [
              "index-8737e582.js",
              "index-9cd505a2.js",
            ],
          },
          "routes/index": Object {
            "fileName": "routes/index.js",
            "imports": Array [
              "index-8737e582.js",
              "index-9cd505a2.js",
            ],
          },
        }
      `);
    });
  });

  describe("the production browser build", () => {
    it("generates the correct bundles and manifest", async () => {
      let { output } = await generateBuild(config, {
        mode: BuildMode.Production,
        target: BuildTarget.Browser
      });

      expect(output.map(item => item.fileName)).toMatchInlineSnapshot(`
        Array [
          "entry-browser-b964a8b4.js",
          "routes/404-ee7a8fa3.js",
          "routes/500-0ed7b250.js",
          "routes/gists-b954eabb.js",
          "routes/gists/$username-4ef5b1c1.js",
          "routes/gists/index-fe2366f3.js",
          "routes/gists.mine-960acbb5.js",
          "routes/index-eae14122.js",
          "pages/one-e5e06b1b.js",
          "pages/two-035bf744.js",
          "index-3921cad2.js",
          "index-3428c457.js",
          "esm-26aee512.js",
          "global-ec887178.css",
          "routes/gists-a6d2a823.css",
          "asset-manifest.json",
        ]
      `);

      let manifest = output.find(
        item => item.fileName === "asset-manifest.json"
      ) as OutputAsset;

      expect(JSON.parse(manifest.source as string)).toMatchInlineSnapshot(`
        Object {
          "entry-browser": Object {
            "fileName": "entry-browser-b964a8b4.js",
            "imports": Array [
              "index-3921cad2.js",
              "index-3428c457.js",
            ],
          },
          "global.css": Object {
            "fileName": "global-ec887178.css",
          },
          "pages/one": Object {
            "fileName": "pages/one-e5e06b1b.js",
            "imports": Array [
              "index-3921cad2.js",
              "esm-26aee512.js",
            ],
          },
          "pages/two": Object {
            "fileName": "pages/two-035bf744.js",
            "imports": Array [
              "index-3921cad2.js",
              "esm-26aee512.js",
            ],
          },
          "routes/404": Object {
            "fileName": "routes/404-ee7a8fa3.js",
            "imports": Array [
              "index-3921cad2.js",
            ],
          },
          "routes/500": Object {
            "fileName": "routes/500-0ed7b250.js",
            "imports": Array [
              "index-3921cad2.js",
            ],
          },
          "routes/gists": Object {
            "fileName": "routes/gists-b954eabb.js",
            "imports": Array [
              "index-3921cad2.js",
              "index-3428c457.js",
            ],
          },
          "routes/gists.css": Object {
            "fileName": "routes/gists-a6d2a823.css",
          },
          "routes/gists.mine": Object {
            "fileName": "routes/gists.mine-960acbb5.js",
            "imports": Array [
              "index-3921cad2.js",
            ],
          },
          "routes/gists/$username": Object {
            "fileName": "routes/gists/$username-4ef5b1c1.js",
            "imports": Array [
              "index-3921cad2.js",
              "index-3428c457.js",
            ],
          },
          "routes/gists/index": Object {
            "fileName": "routes/gists/index-fe2366f3.js",
            "imports": Array [
              "index-3921cad2.js",
              "index-3428c457.js",
            ],
          },
          "routes/index": Object {
            "fileName": "routes/index-eae14122.js",
            "imports": Array [
              "index-3921cad2.js",
              "index-3428c457.js",
            ],
          },
        }
      `);
    });
  });
});
