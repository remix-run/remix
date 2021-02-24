import path from "path";
import type { OutputAsset, RollupOutput } from "rollup";

import { BuildMode, BuildTarget } from "../build";
import type { BuildOptions } from "../compiler";
import { build, generate } from "../compiler";
import type { RemixConfig } from "../config";
import { readConfig } from "../config";

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

const remixRoot = path.resolve(__dirname, "../../../fixtures/gists-app");

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
                "react/jsx-runtime",
                "react",
                "@mdx-js/react",
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
                "@remix-run/react",
                "react-router-dom",
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
                "react-router-dom",
                "@remix-run/data",
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
                "react/jsx-runtime",
                "react",
                "@mdx-js/react",
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
                "@remix-run/react",
                "react-router-dom",
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
                "react-router-dom",
                "@remix-run/data",
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
          "_shared/Shared-82040150.js",
          "_shared/__babel/runtime-88c72f87.js",
          "_shared/__mdx-js/react-5d5d6461.js",
          "_shared/__remix-run/react-702a1c19.js",
          "_shared/history-7c196d23.js",
          "_shared/object-assign-510802f4.js",
          "_shared/prop-types-d309e184.js",
          "_shared/react-9affee2b.js",
          "_shared/react-dom-c1d720cd.js",
          "_shared/react-is-ed1133ad.js",
          "_shared/react-router-941890f0.js",
          "_shared/react-router-dom-b2674127.js",
          "_shared/scheduler-3b92684b.js",
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
                "_shared/react-9affee2b.js",
                "_shared/object-assign-510802f4.js",
                "_shared/scheduler-3b92684b.js",
                "_shared/react-dom-c1d720cd.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-7c196d23.js",
                "_shared/__remix-run/react-702a1c19.js",
                "_shared/react-is-ed1133ad.js",
                "_shared/prop-types-d309e184.js",
                "_shared/react-router-941890f0.js",
              ],
            },
            "pages/one": Object {
              "file": "pages/one.js",
              "imports": Array [
                "_shared/react-9affee2b.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__mdx-js/react-5d5d6461.js",
              ],
            },
            "pages/two": Object {
              "file": "pages/two.js",
              "imports": Array [
                "_shared/react-9affee2b.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__mdx-js/react-5d5d6461.js",
              ],
            },
            "root": Object {
              "file": "root.js",
              "imports": Array [
                "_shared/react-9affee2b.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-7c196d23.js",
                "_shared/__remix-run/react-702a1c19.js",
                "_shared/react-is-ed1133ad.js",
                "_shared/prop-types-d309e184.js",
                "_shared/react-router-941890f0.js",
                "_shared/react-router-dom-b2674127.js",
              ],
            },
            "routes/404": Object {
              "file": "routes/404.js",
              "imports": Array [
                "_shared/react-9affee2b.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "routes/gists": Object {
              "file": "routes/gists.js",
              "imports": Array [
                "_shared/react-9affee2b.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-7c196d23.js",
                "_shared/__remix-run/react-702a1c19.js",
                "_shared/react-is-ed1133ad.js",
                "_shared/prop-types-d309e184.js",
                "_shared/react-router-941890f0.js",
                "_shared/react-router-dom-b2674127.js",
                "_shared/Shared-82040150.js",
              ],
            },
            "routes/gists.mine": Object {
              "file": "routes/gists.mine.js",
              "imports": Array [
                "_shared/react-9affee2b.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "routes/gists/$username": Object {
              "file": "routes/gists/$username.js",
              "imports": Array [
                "_shared/react-9affee2b.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-7c196d23.js",
                "_shared/__remix-run/react-702a1c19.js",
                "_shared/react-is-ed1133ad.js",
                "_shared/prop-types-d309e184.js",
                "_shared/react-router-941890f0.js",
                "_shared/react-router-dom-b2674127.js",
              ],
            },
            "routes/gists/index": Object {
              "file": "routes/gists/index.js",
              "imports": Array [
                "_shared/react-9affee2b.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-7c196d23.js",
                "_shared/__remix-run/react-702a1c19.js",
                "_shared/react-is-ed1133ad.js",
                "_shared/prop-types-d309e184.js",
                "_shared/react-router-941890f0.js",
              ],
            },
            "routes/index": Object {
              "file": "routes/index.js",
              "imports": Array [
                "_shared/react-9affee2b.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-7c196d23.js",
                "_shared/__remix-run/react-702a1c19.js",
                "_shared/react-is-ed1133ad.js",
                "_shared/prop-types-d309e184.js",
                "_shared/react-router-941890f0.js",
                "_shared/react-router-dom-b2674127.js",
                "_shared/Shared-82040150.js",
              ],
            },
            "routes/links": Object {
              "file": "routes/links.js",
              "imports": Array [
                "_shared/react-9affee2b.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-7c196d23.js",
                "_shared/__remix-run/react-702a1c19.js",
                "_shared/react-is-ed1133ad.js",
                "_shared/prop-types-d309e184.js",
                "_shared/react-router-941890f0.js",
                "_shared/react-router-dom-b2674127.js",
              ],
            },
            "routes/loader-errors": Object {
              "file": "routes/loader-errors.js",
              "imports": Array [
                "_shared/react-9affee2b.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-7c196d23.js",
                "_shared/react-is-ed1133ad.js",
                "_shared/prop-types-d309e184.js",
                "_shared/react-router-941890f0.js",
              ],
            },
            "routes/loader-errors/nested": Object {
              "file": "routes/loader-errors/nested.js",
              "imports": Array [
                "_shared/react-9affee2b.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "routes/methods": Object {
              "file": "routes/methods.js",
              "imports": Array [
                "_shared/react-9affee2b.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-7c196d23.js",
                "_shared/__remix-run/react-702a1c19.js",
                "_shared/react-is-ed1133ad.js",
                "_shared/prop-types-d309e184.js",
                "_shared/react-router-941890f0.js",
              ],
            },
            "routes/page/four": Object {
              "file": "routes/page/four.js",
              "imports": Array [
                "_shared/react-9affee2b.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__mdx-js/react-5d5d6461.js",
              ],
            },
            "routes/page/three": Object {
              "file": "routes/page/three.js",
              "imports": Array [
                "_shared/react-9affee2b.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__mdx-js/react-5d5d6461.js",
              ],
            },
            "routes/prefs": Object {
              "file": "routes/prefs.js",
              "imports": Array [
                "_shared/react-9affee2b.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-7c196d23.js",
                "_shared/__remix-run/react-702a1c19.js",
                "_shared/react-is-ed1133ad.js",
                "_shared/prop-types-d309e184.js",
                "_shared/react-router-941890f0.js",
                "_shared/react-router-dom-b2674127.js",
              ],
            },
            "routes/render-errors": Object {
              "file": "routes/render-errors.js",
              "imports": Array [
                "_shared/react-9affee2b.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-7c196d23.js",
                "_shared/react-is-ed1133ad.js",
                "_shared/prop-types-d309e184.js",
                "_shared/react-router-941890f0.js",
              ],
            },
            "routes/render-errors/nested": Object {
              "file": "routes/render-errors/nested.js",
              "imports": Array [
                "_shared/react-9affee2b.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "styles/methods.css": Object {
              "file": "styles/methods.css",
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
          "_shared/Shared-477fe0ef.js",
          "_shared/__babel/runtime-88c72f87.js",
          "_shared/__mdx-js/react-be7f99ea.js",
          "_shared/__remix-run/react-d851d2b0.js",
          "_shared/history-e6417d88.js",
          "_shared/object-assign-510802f4.js",
          "_shared/prop-types-23bdf19c.js",
          "_shared/react-846ce928.js",
          "_shared/react-dom-cb0f8bba.js",
          "_shared/react-is-2e9e0736.js",
          "_shared/react-router-0648eaac.js",
          "_shared/react-router-dom-8dabe7d8.js",
          "_shared/scheduler-e5d0ec88.js",
          "asset-manifest.json",
          "entry.client-6c2566d7.js",
          "pages/one-56dfb05a.js",
          "pages/two-15c7c30a.js",
          "root-23846390.js",
          "routes/404-d139d806.js",
          "routes/gists-6ab6d111.js",
          "routes/gists.mine-79e36fd1.js",
          "routes/gists/$username-782ee981.js",
          "routes/gists/index-39e21659.js",
          "routes/index-35a3639f.js",
          "routes/links-9d8c3996.js",
          "routes/loader-errors-9b669e81.js",
          "routes/loader-errors/nested-8ebeaaa8.js",
          "routes/methods-bb5a4238.js",
          "routes/page/four-3b06dd58.js",
          "routes/page/three-c6385a5c.js",
          "routes/prefs-4923d2e1.js",
          "routes/render-errors-87632db8.js",
          "routes/render-errors/nested-0669a18a.js",
          "styles/methods-4b89abbd.css",
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
              "file": "entry.client-6c2566d7.js",
              "imports": Array [
                "_shared/react-846ce928.js",
                "_shared/object-assign-510802f4.js",
                "_shared/scheduler-e5d0ec88.js",
                "_shared/react-dom-cb0f8bba.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/__remix-run/react-d851d2b0.js",
                "_shared/react-is-2e9e0736.js",
                "_shared/prop-types-23bdf19c.js",
                "_shared/react-router-0648eaac.js",
              ],
            },
            "pages/one": Object {
              "file": "pages/one-56dfb05a.js",
              "imports": Array [
                "_shared/react-846ce928.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__mdx-js/react-be7f99ea.js",
              ],
            },
            "pages/two": Object {
              "file": "pages/two-15c7c30a.js",
              "imports": Array [
                "_shared/react-846ce928.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__mdx-js/react-be7f99ea.js",
              ],
            },
            "root": Object {
              "file": "root-23846390.js",
              "imports": Array [
                "_shared/react-846ce928.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/__remix-run/react-d851d2b0.js",
                "_shared/react-is-2e9e0736.js",
                "_shared/prop-types-23bdf19c.js",
                "_shared/react-router-0648eaac.js",
                "_shared/react-router-dom-8dabe7d8.js",
              ],
            },
            "routes/404": Object {
              "file": "routes/404-d139d806.js",
              "imports": Array [
                "_shared/react-846ce928.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "routes/gists": Object {
              "file": "routes/gists-6ab6d111.js",
              "imports": Array [
                "_shared/react-846ce928.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/__remix-run/react-d851d2b0.js",
                "_shared/react-is-2e9e0736.js",
                "_shared/prop-types-23bdf19c.js",
                "_shared/react-router-0648eaac.js",
                "_shared/react-router-dom-8dabe7d8.js",
                "_shared/Shared-477fe0ef.js",
              ],
            },
            "routes/gists.mine": Object {
              "file": "routes/gists.mine-79e36fd1.js",
              "imports": Array [
                "_shared/react-846ce928.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "routes/gists/$username": Object {
              "file": "routes/gists/$username-782ee981.js",
              "imports": Array [
                "_shared/react-846ce928.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/__remix-run/react-d851d2b0.js",
                "_shared/react-is-2e9e0736.js",
                "_shared/prop-types-23bdf19c.js",
                "_shared/react-router-0648eaac.js",
                "_shared/react-router-dom-8dabe7d8.js",
              ],
            },
            "routes/gists/index": Object {
              "file": "routes/gists/index-39e21659.js",
              "imports": Array [
                "_shared/react-846ce928.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/__remix-run/react-d851d2b0.js",
                "_shared/react-is-2e9e0736.js",
                "_shared/prop-types-23bdf19c.js",
                "_shared/react-router-0648eaac.js",
              ],
            },
            "routes/index": Object {
              "file": "routes/index-35a3639f.js",
              "imports": Array [
                "_shared/react-846ce928.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/__remix-run/react-d851d2b0.js",
                "_shared/react-is-2e9e0736.js",
                "_shared/prop-types-23bdf19c.js",
                "_shared/react-router-0648eaac.js",
                "_shared/react-router-dom-8dabe7d8.js",
                "_shared/Shared-477fe0ef.js",
              ],
            },
            "routes/links": Object {
              "file": "routes/links-9d8c3996.js",
              "imports": Array [
                "_shared/react-846ce928.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/__remix-run/react-d851d2b0.js",
                "_shared/react-is-2e9e0736.js",
                "_shared/prop-types-23bdf19c.js",
                "_shared/react-router-0648eaac.js",
                "_shared/react-router-dom-8dabe7d8.js",
              ],
            },
            "routes/loader-errors": Object {
              "file": "routes/loader-errors-9b669e81.js",
              "imports": Array [
                "_shared/react-846ce928.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/react-is-2e9e0736.js",
                "_shared/prop-types-23bdf19c.js",
                "_shared/react-router-0648eaac.js",
              ],
            },
            "routes/loader-errors/nested": Object {
              "file": "routes/loader-errors/nested-8ebeaaa8.js",
              "imports": Array [
                "_shared/react-846ce928.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "routes/methods": Object {
              "file": "routes/methods-bb5a4238.js",
              "imports": Array [
                "_shared/react-846ce928.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/__remix-run/react-d851d2b0.js",
                "_shared/react-is-2e9e0736.js",
                "_shared/prop-types-23bdf19c.js",
                "_shared/react-router-0648eaac.js",
              ],
            },
            "routes/page/four": Object {
              "file": "routes/page/four-3b06dd58.js",
              "imports": Array [
                "_shared/react-846ce928.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__mdx-js/react-be7f99ea.js",
              ],
            },
            "routes/page/three": Object {
              "file": "routes/page/three-c6385a5c.js",
              "imports": Array [
                "_shared/react-846ce928.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__mdx-js/react-be7f99ea.js",
              ],
            },
            "routes/prefs": Object {
              "file": "routes/prefs-4923d2e1.js",
              "imports": Array [
                "_shared/react-846ce928.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/__remix-run/react-d851d2b0.js",
                "_shared/react-is-2e9e0736.js",
                "_shared/prop-types-23bdf19c.js",
                "_shared/react-router-0648eaac.js",
                "_shared/react-router-dom-8dabe7d8.js",
              ],
            },
            "routes/render-errors": Object {
              "file": "routes/render-errors-87632db8.js",
              "imports": Array [
                "_shared/react-846ce928.js",
                "_shared/object-assign-510802f4.js",
                "_shared/__babel/runtime-88c72f87.js",
                "_shared/history-e6417d88.js",
                "_shared/react-is-2e9e0736.js",
                "_shared/prop-types-23bdf19c.js",
                "_shared/react-router-0648eaac.js",
              ],
            },
            "routes/render-errors/nested": Object {
              "file": "routes/render-errors/nested-0669a18a.js",
              "imports": Array [
                "_shared/react-846ce928.js",
                "_shared/object-assign-510802f4.js",
              ],
            },
            "styles/methods.css": Object {
              "file": "styles/methods-4b89abbd.css",
            },
          },
          "version": Any<String>,
        }
      `
      );
    });
  });
});
