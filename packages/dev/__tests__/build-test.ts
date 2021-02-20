import path from "path";
import type { OutputAsset, RollupOutput } from "rollup";
import { BuildMode, BuildTarget } from "@remix-run/core";

import type { BuildOptions } from "../compiler";
import { build, generate } from "../compiler";
import type { RemixConfig } from "../config";
import { readConfig } from "../config";

const remixRoot = path.resolve(__dirname, "../../../fixtures/gists-app");

async function generateBuild(config: RemixConfig, options: BuildOptions) {
  return await generate(await build(config, options));
}

function getFilenames(output: RollupOutput) {
  return output.output.map(item => item.fileName).sort();
}

function getManifest(output: RollupOutput, name: string) {
  let asset = output.output.find(
    item => item.type === "asset" && item.fileName === name
  ) as OutputAsset;

  return JSON.parse(asset.source as string);
}

describe.skip("building", () => {
  // describe("building", () => {
  let config: RemixConfig;
  beforeAll(async () => {
    config = await readConfig(remixRoot);
  });

  beforeEach(() => {
    jest.setTimeout(20000);
  });

  describe("the development server build", () => {
    it("generates the correct bundles and manifest", async () => {
      let output = await generateBuild(config, {
        mode: BuildMode.Development,
        target: BuildTarget.Server
      });

      expect(getFilenames(output)).toMatchInlineSnapshot(`
        Array [
          "_shared/Shared-072c977d.js",
          "entry.server.js",
          "pages/one.js",
          "pages/two.js",
          "root.js",
          "routes/404.js",
          "routes/gists.js",
          "routes/gists.mine.js",
          "routes/gists/$username.js",
          "routes/gists/index.js",
          "routes/index.js",
          "routes/links.js",
          "routes/loader-errors.js",
          "routes/loader-errors/nested.js",
          "routes/methods.js",
          "routes/page/four.js",
          "routes/page/three.js",
          "routes/prefs.js",
          "routes/render-errors.js",
          "routes/render-errors/nested.js",
          "server-manifest.json",
          "styles/methods.css",
          "styles/redText.css",
        ]
      `);

      expect(getManifest(output, "server-manifest.json")).toMatchInlineSnapshot(
        {
          version: expect.any(String)
        },
        `
        Object {
          "entries": Object {
            "entry.server": Object {
              "file": "entry.server.js",
              "imports": Array [
                "react/jsx-runtime",
                "react-dom/server",
                "@remix-run/react/server",
              ],
            },
            "pages/one": Object {
              "file": "pages/one.js",
              "imports": Array [
                "@mdx-js/react",
                "react/jsx-runtime",
                "react",
              ],
            },
            "pages/two": Object {
              "file": "pages/two.js",
              "imports": Array [
                "@mdx-js/react",
              ],
            },
            "root": Object {
              "file": "root.js",
              "imports": Array [
                "react/jsx-runtime",
                "react",
                "@remix-run/react",
                "react-router-dom",
              ],
            },
            "routes/404": Object {
              "file": "routes/404.js",
              "imports": Array [
                "react/jsx-runtime",
              ],
            },
            "routes/gists": Object {
              "file": "routes/gists.js",
              "imports": Array [
                "react/jsx-runtime",
                "react-router-dom",
                "@remix-run/react",
                "@remix-run/data",
                "_shared/Shared-072c977d.js",
              ],
            },
            "routes/gists.mine": Object {
              "file": "routes/gists.mine.js",
              "imports": Array [
                "react/jsx-runtime",
              ],
            },
            "routes/gists/$username": Object {
              "file": "routes/gists/$username.js",
              "imports": Array [
                "react/jsx-runtime",
                "@remix-run/react",
                "react-router-dom",
                "@remix-run/data",
              ],
            },
            "routes/gists/index": Object {
              "file": "routes/gists/index.js",
              "imports": Array [
                "react/jsx-runtime",
                "@remix-run/react",
              ],
            },
            "routes/index": Object {
              "file": "routes/index.js",
              "imports": Array [
                "react/jsx-runtime",
                "react",
                "@remix-run/react",
                "_shared/Shared-072c977d.js",
              ],
            },
            "routes/links": Object {
              "file": "routes/links.js",
              "imports": Array [
                "react/jsx-runtime",
                "@remix-run/react",
              ],
            },
            "routes/loader-errors": Object {
              "file": "routes/loader-errors.js",
              "imports": Array [
                "react/jsx-runtime",
                "react-router-dom",
              ],
            },
            "routes/loader-errors/nested": Object {
              "file": "routes/loader-errors/nested.js",
              "imports": Array [
                "react/jsx-runtime",
              ],
            },
            "routes/methods": Object {
              "file": "routes/methods.js",
              "imports": Array [
                "react/jsx-runtime",
                "react",
                "@remix-run/react",
                "@remix-run/data",
              ],
            },
            "routes/page/four": Object {
              "file": "routes/page/four.js",
              "imports": Array [
                "@mdx-js/react",
              ],
            },
            "routes/page/three": Object {
              "file": "routes/page/three.js",
              "imports": Array [
                "@mdx-js/react",
              ],
            },
            "routes/prefs": Object {
              "file": "routes/prefs.js",
              "imports": Array [
                "react/jsx-runtime",
                "@remix-run/react",
                "@remix-run/data",
                "react-router-dom",
              ],
            },
            "routes/render-errors": Object {
              "file": "routes/render-errors.js",
              "imports": Array [
                "react/jsx-runtime",
                "react-router-dom",
              ],
            },
            "routes/render-errors/nested": Object {
              "file": "routes/render-errors/nested.js",
              "imports": Array [
                "react/jsx-runtime",
              ],
            },
            "styles/methods.css": Object {
              "file": "styles/methods.css",
            },
            "styles/redText.css": Object {
              "file": "styles/redText.css",
            },
          },
          "version": Any<String>,
        }
      `
      );
    });
  });

  describe("the production server build", () => {
    it("generates the correct bundles and manifest", async () => {
      let output = await generateBuild(config, {
        mode: BuildMode.Production,
        target: BuildTarget.Server
      });

      expect(getFilenames(output)).toMatchInlineSnapshot(`
        Array [
          "_shared/Shared-072c977d.js",
          "entry.server.js",
          "pages/one.js",
          "pages/two.js",
          "root.js",
          "routes/404.js",
          "routes/gists.js",
          "routes/gists.mine.js",
          "routes/gists/$username.js",
          "routes/gists/index.js",
          "routes/index.js",
          "routes/links.js",
          "routes/loader-errors.js",
          "routes/loader-errors/nested.js",
          "routes/methods.js",
          "routes/page/four.js",
          "routes/page/three.js",
          "routes/prefs.js",
          "routes/render-errors.js",
          "routes/render-errors/nested.js",
          "server-manifest.json",
          "styles/methods.css",
          "styles/redText.css",
        ]
      `);

      expect(getManifest(output, "server-manifest.json")).toMatchInlineSnapshot(
        {
          version: expect.any(String)
        },
        `
        Object {
          "entries": Object {
            "entry.server": Object {
              "file": "entry.server.js",
              "imports": Array [
                "react/jsx-runtime",
                "react-dom/server",
                "@remix-run/react/server",
              ],
            },
            "pages/one": Object {
              "file": "pages/one.js",
              "imports": Array [
                "@mdx-js/react",
                "react/jsx-runtime",
                "react",
              ],
            },
            "pages/two": Object {
              "file": "pages/two.js",
              "imports": Array [
                "@mdx-js/react",
              ],
            },
            "root": Object {
              "file": "root.js",
              "imports": Array [
                "react/jsx-runtime",
                "react",
                "@remix-run/react",
                "react-router-dom",
              ],
            },
            "routes/404": Object {
              "file": "routes/404.js",
              "imports": Array [
                "react/jsx-runtime",
              ],
            },
            "routes/gists": Object {
              "file": "routes/gists.js",
              "imports": Array [
                "react/jsx-runtime",
                "react-router-dom",
                "@remix-run/react",
                "@remix-run/data",
                "_shared/Shared-072c977d.js",
              ],
            },
            "routes/gists.mine": Object {
              "file": "routes/gists.mine.js",
              "imports": Array [
                "react/jsx-runtime",
              ],
            },
            "routes/gists/$username": Object {
              "file": "routes/gists/$username.js",
              "imports": Array [
                "react/jsx-runtime",
                "@remix-run/react",
                "react-router-dom",
                "@remix-run/data",
              ],
            },
            "routes/gists/index": Object {
              "file": "routes/gists/index.js",
              "imports": Array [
                "react/jsx-runtime",
                "@remix-run/react",
              ],
            },
            "routes/index": Object {
              "file": "routes/index.js",
              "imports": Array [
                "react/jsx-runtime",
                "react",
                "@remix-run/react",
                "_shared/Shared-072c977d.js",
              ],
            },
            "routes/links": Object {
              "file": "routes/links.js",
              "imports": Array [
                "react/jsx-runtime",
                "@remix-run/react",
              ],
            },
            "routes/loader-errors": Object {
              "file": "routes/loader-errors.js",
              "imports": Array [
                "react/jsx-runtime",
                "react-router-dom",
              ],
            },
            "routes/loader-errors/nested": Object {
              "file": "routes/loader-errors/nested.js",
              "imports": Array [
                "react/jsx-runtime",
              ],
            },
            "routes/methods": Object {
              "file": "routes/methods.js",
              "imports": Array [
                "react/jsx-runtime",
                "react",
                "@remix-run/react",
                "@remix-run/data",
              ],
            },
            "routes/page/four": Object {
              "file": "routes/page/four.js",
              "imports": Array [
                "@mdx-js/react",
              ],
            },
            "routes/page/three": Object {
              "file": "routes/page/three.js",
              "imports": Array [
                "@mdx-js/react",
              ],
            },
            "routes/prefs": Object {
              "file": "routes/prefs.js",
              "imports": Array [
                "react/jsx-runtime",
                "@remix-run/react",
                "@remix-run/data",
                "react-router-dom",
              ],
            },
            "routes/render-errors": Object {
              "file": "routes/render-errors.js",
              "imports": Array [
                "react/jsx-runtime",
                "react-router-dom",
              ],
            },
            "routes/render-errors/nested": Object {
              "file": "routes/render-errors/nested.js",
              "imports": Array [
                "react/jsx-runtime",
              ],
            },
            "styles/methods.css": Object {
              "file": "styles/methods.css",
            },
            "styles/redText.css": Object {
              "file": "styles/redText.css",
            },
          },
          "version": Any<String>,
        }
      `
      );
    });
  });

  describe("the development browser build", () => {
    it("generates the correct bundles and manifest", async () => {
      let output = await generateBuild(config, {
        mode: BuildMode.Development,
        target: BuildTarget.Browser
      });

      expect(getFilenames(output)).toMatchInlineSnapshot(`
        Array [
          "_shared/Shared-d9a35912.js",
          "_shared/__babel/runtime-88c72f87.js",
          "_shared/__mdx-js/react-4850335b.js",
          "_shared/__remix-run/react-dcf12c0e.js",
          "_shared/history-7c196d23.js",
          "_shared/object-assign-510802f4.js",
          "_shared/prop-types-7d470aaa.js",
          "_shared/react-583fa859.js",
          "_shared/react-dom-9e145e84.js",
          "_shared/react-is-61089b68.js",
          "_shared/react-router-deab4d0e.js",
          "_shared/react-router-dom-7a77fcbe.js",
          "_shared/scheduler-a3345876.js",
          "asset-manifest.json",
          "entry.client.js",
          "pages/one.js",
          "pages/two.js",
          "root.js",
          "routes/404.js",
          "routes/gists.js",
          "routes/gists.mine.js",
          "routes/gists/$username.js",
          "routes/gists/index.js",
          "routes/index.js",
          "routes/links.js",
          "routes/loader-errors.js",
          "routes/loader-errors/nested.js",
          "routes/methods.js",
          "routes/page/four.js",
          "routes/page/three.js",
          "routes/prefs.js",
          "routes/render-errors.js",
          "routes/render-errors/nested.js",
          "styles/methods.css",
          "styles/redText.css",
        ]
      `);

      expect(getManifest(output, "asset-manifest.json")).toMatchInlineSnapshot(
        {
          version: expect.any(String)
        },
        `
        Object {
          "entries": Object {
            "entry.client": Object {
              "file": "entry.client.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/react-dom-9e145e84.js",
                "_shared/__remix-run/react-dcf12c0e.js",
                "_shared/object-assign-510802f4.js",
                "_shared/scheduler-a3345876.js",
                "_shared/history-7c196d23.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/react-router-deab4d0e.js",
                "_shared/prop-types-7d470aaa.js",
                "_shared/react-is-61089b68.js",
              ],
            },
            "pages/one": Object {
              "file": "pages/one.js",
              "imports": Array [
                "_shared/__mdx-js/react-4850335b.js",
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "pages/two": Object {
              "file": "pages/two.js",
              "imports": Array [
                "_shared/__mdx-js/react-4850335b.js",
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "root": Object {
              "file": "root.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/react-router-dom-7a77fcbe.js",
                "_shared/__remix-run/react-dcf12c0e.js",
                "_shared/react-router-deab4d0e.js",
                "_shared/object-assign-510802f4.js",
                "_shared/history-7c196d23.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/prop-types-7d470aaa.js",
                "_shared/react-is-61089b68.js",
              ],
            },
            "routes/404": Object {
              "file": "routes/404.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "routes/gists": Object {
              "file": "routes/gists.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/react-router-dom-7a77fcbe.js",
                "_shared/Shared-d9a35912.js",
                "_shared/__remix-run/react-dcf12c0e.js",
                "_shared/react-router-deab4d0e.js",
                "_shared/object-assign-510802f4.js",
                "_shared/history-7c196d23.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/prop-types-7d470aaa.js",
                "_shared/react-is-61089b68.js",
              ],
            },
            "routes/gists.mine": Object {
              "file": "routes/gists.mine.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "routes/gists/$username": Object {
              "file": "routes/gists/$username.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/react-router-dom-7a77fcbe.js",
                "_shared/react-router-deab4d0e.js",
                "_shared/__remix-run/react-dcf12c0e.js",
                "_shared/object-assign-510802f4.js",
                "_shared/history-7c196d23.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/prop-types-7d470aaa.js",
                "_shared/react-is-61089b68.js",
              ],
            },
            "routes/gists/index": Object {
              "file": "routes/gists/index.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/__remix-run/react-dcf12c0e.js",
                "_shared/object-assign-510802f4.js",
                "_shared/history-7c196d23.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/react-router-deab4d0e.js",
                "_shared/prop-types-7d470aaa.js",
                "_shared/react-is-61089b68.js",
              ],
            },
            "routes/index": Object {
              "file": "routes/index.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/Shared-d9a35912.js",
                "_shared/react-router-dom-7a77fcbe.js",
                "_shared/object-assign-510802f4.js",
                "_shared/react-router-deab4d0e.js",
                "_shared/history-7c196d23.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/prop-types-7d470aaa.js",
                "_shared/react-is-61089b68.js",
              ],
            },
            "routes/links": Object {
              "file": "routes/links.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/__remix-run/react-dcf12c0e.js",
                "_shared/react-router-dom-7a77fcbe.js",
                "_shared/object-assign-510802f4.js",
                "_shared/history-7c196d23.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/react-router-deab4d0e.js",
                "_shared/prop-types-7d470aaa.js",
                "_shared/react-is-61089b68.js",
              ],
            },
            "routes/loader-errors": Object {
              "file": "routes/loader-errors.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/react-router-deab4d0e.js",
                "_shared/object-assign-510802f4.js",
                "_shared/history-7c196d23.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/prop-types-7d470aaa.js",
                "_shared/react-is-61089b68.js",
              ],
            },
            "routes/loader-errors/nested": Object {
              "file": "routes/loader-errors/nested.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "routes/methods": Object {
              "file": "routes/methods.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/__remix-run/react-dcf12c0e.js",
                "_shared/object-assign-510802f4.js",
                "_shared/history-7c196d23.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/react-router-deab4d0e.js",
                "_shared/prop-types-7d470aaa.js",
                "_shared/react-is-61089b68.js",
              ],
            },
            "routes/page/four": Object {
              "file": "routes/page/four.js",
              "imports": Array [
                "_shared/__mdx-js/react-4850335b.js",
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "routes/page/three": Object {
              "file": "routes/page/three.js",
              "imports": Array [
                "_shared/__mdx-js/react-4850335b.js",
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "routes/prefs": Object {
              "file": "routes/prefs.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/react-router-dom-7a77fcbe.js",
                "_shared/__remix-run/react-dcf12c0e.js",
                "_shared/object-assign-510802f4.js",
                "_shared/react-router-deab4d0e.js",
                "_shared/history-7c196d23.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/prop-types-7d470aaa.js",
                "_shared/react-is-61089b68.js",
              ],
            },
            "routes/render-errors": Object {
              "file": "routes/render-errors.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/react-router-deab4d0e.js",
                "_shared/object-assign-510802f4.js",
                "_shared/history-7c196d23.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/prop-types-7d470aaa.js",
                "_shared/react-is-61089b68.js",
              ],
            },
            "routes/render-errors/nested": Object {
              "file": "routes/render-errors/nested.js",
              "imports": Array [
                "_shared/react-583fa859.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "styles/methods.css": Object {
              "file": "styles/methods.css",
            },
            "styles/redText.css": Object {
              "file": "styles/redText.css",
            },
          },
          "version": Any<String>,
        }
      `
      );
    });
  });

  describe("the production browser build", () => {
    it("generates the correct bundles and manifest", async () => {
      let output = await generateBuild(config, {
        mode: BuildMode.Production,
        target: BuildTarget.Browser
      });

      expect(getFilenames(output)).toMatchInlineSnapshot(`
        Array [
          "_shared/Shared-035a27e3.js",
          "_shared/__babel/runtime-88c72f87.js",
          "_shared/__mdx-js/react-d4d6fcba.js",
          "_shared/__remix-run/react-6ad1391a.js",
          "_shared/history-e6417d88.js",
          "_shared/object-assign-510802f4.js",
          "_shared/prop-types-6a72a2b3.js",
          "_shared/react-b1327803.js",
          "_shared/react-dom-8c4c319e.js",
          "_shared/react-is-5210daad.js",
          "_shared/react-router-58ccdc02.js",
          "_shared/react-router-dom-e548f0e3.js",
          "_shared/scheduler-f50f12dc.js",
          "asset-manifest.json",
          "entry.client-c99d7020.js",
          "pages/one-e140e0ed.js",
          "pages/two-f5e8fcdc.js",
          "root-b5792d50.js",
          "routes/404-2d58ffe6.js",
          "routes/gists-7f0e143e.js",
          "routes/gists.mine-7f496bc0.js",
          "routes/gists/$username-98581f5d.js",
          "routes/gists/index-491c4922.js",
          "routes/index-b48c2477.js",
          "routes/links-d2643784.js",
          "routes/loader-errors-7a9ebb32.js",
          "routes/loader-errors/nested-5fec12d3.js",
          "routes/methods-b5240f48.js",
          "routes/page/four-07d4d315.js",
          "routes/page/three-6cb553c8.js",
          "routes/prefs-e1276cf9.js",
          "routes/render-errors-475a1222.js",
          "routes/render-errors/nested-b93fd3ee.js",
          "styles/methods-4b89abbd.css",
          "styles/redText-1bade075.css",
        ]
      `);

      expect(getManifest(output, "asset-manifest.json")).toMatchInlineSnapshot(
        {
          version: expect.any(String)
        },
        `
        Object {
          "entries": Object {
            "entry.client": Object {
              "file": "entry.client-c99d7020.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/react-dom-8c4c319e.js",
                "_shared/__remix-run/react-6ad1391a.js",
                "_shared/object-assign-510802f4.js",
                "_shared/scheduler-f50f12dc.js",
                "_shared/history-e6417d88.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/react-router-58ccdc02.js",
              ],
            },
            "pages/one": Object {
              "file": "pages/one-e140e0ed.js",
              "imports": Array [
                "_shared/__mdx-js/react-d4d6fcba.js",
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "pages/two": Object {
              "file": "pages/two-f5e8fcdc.js",
              "imports": Array [
                "_shared/__mdx-js/react-d4d6fcba.js",
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "root": Object {
              "file": "root-b5792d50.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/react-router-dom-e548f0e3.js",
                "_shared/__remix-run/react-6ad1391a.js",
                "_shared/react-router-58ccdc02.js",
                "_shared/object-assign-510802f4.js",
                "_shared/history-e6417d88.js",
                "_shared/__babel/runtime-88c72f87.js",
              ],
            },
            "routes/404": Object {
              "file": "routes/404-2d58ffe6.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "routes/gists": Object {
              "file": "routes/gists-7f0e143e.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/react-router-dom-e548f0e3.js",
                "_shared/Shared-035a27e3.js",
                "_shared/__remix-run/react-6ad1391a.js",
                "_shared/react-router-58ccdc02.js",
                "_shared/object-assign-510802f4.js",
                "_shared/history-e6417d88.js",
                "_shared/__babel/runtime-88c72f87.js",
              ],
            },
            "routes/gists.mine": Object {
              "file": "routes/gists.mine-7f496bc0.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "routes/gists/$username": Object {
              "file": "routes/gists/$username-98581f5d.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/react-router-dom-e548f0e3.js",
                "_shared/react-router-58ccdc02.js",
                "_shared/__remix-run/react-6ad1391a.js",
                "_shared/object-assign-510802f4.js",
                "_shared/history-e6417d88.js",
                "_shared/__babel/runtime-88c72f87.js",
              ],
            },
            "routes/gists/index": Object {
              "file": "routes/gists/index-491c4922.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/__remix-run/react-6ad1391a.js",
                "_shared/object-assign-510802f4.js",
                "_shared/history-e6417d88.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/react-router-58ccdc02.js",
              ],
            },
            "routes/index": Object {
              "file": "routes/index-b48c2477.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/Shared-035a27e3.js",
                "_shared/react-router-dom-e548f0e3.js",
                "_shared/object-assign-510802f4.js",
                "_shared/react-router-58ccdc02.js",
                "_shared/history-e6417d88.js",
                "_shared/__babel/runtime-88c72f87.js",
              ],
            },
            "routes/links": Object {
              "file": "routes/links-d2643784.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/__remix-run/react-6ad1391a.js",
                "_shared/react-router-dom-e548f0e3.js",
                "_shared/object-assign-510802f4.js",
                "_shared/history-e6417d88.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/react-router-58ccdc02.js",
              ],
            },
            "routes/loader-errors": Object {
              "file": "routes/loader-errors-7a9ebb32.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/react-router-58ccdc02.js",
                "_shared/object-assign-510802f4.js",
                "_shared/history-e6417d88.js",
                "_shared/__babel/runtime-88c72f87.js",
              ],
            },
            "routes/loader-errors/nested": Object {
              "file": "routes/loader-errors/nested-5fec12d3.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "routes/methods": Object {
              "file": "routes/methods-b5240f48.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/__remix-run/react-6ad1391a.js",
                "_shared/object-assign-510802f4.js",
                "_shared/history-e6417d88.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/react-router-58ccdc02.js",
              ],
            },
            "routes/page/four": Object {
              "file": "routes/page/four-07d4d315.js",
              "imports": Array [
                "_shared/__mdx-js/react-d4d6fcba.js",
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "routes/page/three": Object {
              "file": "routes/page/three-6cb553c8.js",
              "imports": Array [
                "_shared/__mdx-js/react-d4d6fcba.js",
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "routes/prefs": Object {
              "file": "routes/prefs-e1276cf9.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/react-router-dom-e548f0e3.js",
                "_shared/__remix-run/react-6ad1391a.js",
                "_shared/object-assign-510802f4.js",
                "_shared/react-router-58ccdc02.js",
                "_shared/history-e6417d88.js",
                "_shared/__babel/runtime-88c72f87.js",
              ],
            },
            "routes/render-errors": Object {
              "file": "routes/render-errors-475a1222.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/react-router-58ccdc02.js",
                "_shared/object-assign-510802f4.js",
                "_shared/history-e6417d88.js",
                "_shared/__babel/runtime-88c72f87.js",
              ],
            },
            "routes/render-errors/nested": Object {
              "file": "routes/render-errors/nested-b93fd3ee.js",
              "imports": Array [
                "_shared/react-b1327803.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "styles/methods.css": Object {
              "file": "styles/methods-4b89abbd.css",
            },
            "styles/redText.css": Object {
              "file": "styles/redText-1bade075.css",
            },
          },
          "version": Any<String>,
        }
      `
      );
    });
  });
});
