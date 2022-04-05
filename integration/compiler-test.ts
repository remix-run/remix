import { test, expect } from "@playwright/test";

import { createFixture, createAppFixture, js } from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";

test.describe("compiler", () => {
  let fixture: Fixture;
  let app: AppFixture;

  test.beforeAll(async () => {
    fixture = await createFixture({
      files: {
        "app/fake.server.js": js`
          export const hello = "server";
        `,
        "app/fake.client.js": js`
          export const hello = "client";
        `,
        "app/fake.js": js`
          import { hello as clientHello } from "./fake.client.js";
          import { hello as serverHello } from "./fake.server.js";
          export default clientHello || serverHello;
        `,

        "app/routes/index.jsx": js`
          import fake from "~/fake.js";

          export default function Index() {
            let hasRightModule = fake === (typeof document === "undefined" ? "server" : "client");
            return <div id="index">{String(hasRightModule)}</div>
          }
        `,
        "app/routes/built-ins.jsx": js`
          import { useLoaderData } from "@remix-run/react";
          import * as path from "path";

          export let loader = () => {
            return path.join("test", "file.txt");
          }

          export default function BuiltIns() {
            return <div id="built-ins">{useLoaderData()}</div>
          }
        `,
        "app/routes/built-ins-polyfill.jsx": js`
          import { useLoaderData } from "@remix-run/react";
          import * as path from "path";

          export default function BuiltIns() {
            return <div id="built-ins-polyfill">{path.join("test", "file.txt")}</div>;
          }
        `,
        "app/routes/esm-only-pkg.jsx": js`
          import esmOnlyPkg from "esm-only-pkg";

          export default function EsmOnlyPkg() {
            return <div id="esm-only-pkg">{esmOnlyPkg}</div>;
          }
        `,
        "remix.config.js": js`
          module.exports = {
            serverDependenciesToBundle: ["esm-only-pkg"],
          };
        `,
        "node_modules/esm-only-pkg/package.json": `{
          "name": "esm-only-pkg",
          "version": "1.0.0",
          "type": "module",
          "main": "./esm-only-pkg.js"
        }`,
        "node_modules/esm-only-pkg/esm-only-pkg.js": js`
          export default "esm-only-pkg";
        `,
      },
    });

    app = await createAppFixture(fixture);
  });

  test.afterAll(async () => app.close());

  test("removes server code with `*.server` files", async ({ page }) => {
    let res = await app.goto(page, "/", true);
    expect(res.status()).toBe(200); // server rendered fine

    // rendered the page instead of the error boundary
    expect(await app.getHtml(page, "#index")).toMatchSnapshot();
  });

  test("removes server code with `*.client` files", async ({ page }) => {
    let res = await app.goto(page, "/", true);
    expect(res.status()).toBe(200); // server rendered fine

    // rendered the page instead of the error boundary
    expect(await app.getHtml(page, "#index")).toMatchSnapshot();
  });

  test("removes node built-ins from client bundle when used in just loader", async ({
    page,
  }) => {
    let res = await app.goto(page, "/built-ins", true);
    expect(res.status()).toBe(200); // server rendered fine

    // rendered the page instead of the error boundary
    expect(await app.getHtml(page, "#built-ins")).toMatchSnapshot();

    let routeModule = await fixture.getBrowserAsset(
      fixture.build.assets.routes["routes/built-ins"].module
    );
    // does not include `import bla from "path"` in the output bundle
    expect(routeModule).not.toMatch(/from\s*"path/);
  });

  test("bundles node built-ins polyfill for client bundle when used in client code", async ({
    page,
  }) => {
    let res = await app.goto(page, "/built-ins-polyfill", true);
    expect(res.status()).toBe(200); // server rendered fine

    // rendered the page instead of the error boundary
    expect(await app.getHtml(page, "#built-ins-polyfill")).toMatchSnapshot();

    let routeModule = await fixture.getBrowserAsset(
      fixture.build.assets.routes["routes/built-ins-polyfill"].module
    );
    // does not include `import bla from "path"` in the output bundle
    expect(routeModule).not.toMatch(/from\s*"path/);
  });

  test("allows consumption of ESM modules in CJS builds with `serverDependenciesToBundle`", async ({
    page,
  }) => {
    let res = await app.goto(page, "/esm-only-pkg", true);
    expect(res.status()).toBe(200); // server rendered fine
    // rendered the page instead of the error boundary
    expect(await app.getHtml(page, "#esm-only-pkg")).toMatchSnapshot();
  });
});
