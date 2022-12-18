import { test, expect } from "@playwright/test";

import { PlaywrightFixture } from "./helpers/playwright-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import {
  createAppFixture,
  createFixture,
  css,
  js,
} from "./helpers/create-fixture";

const TEST_PADDING_VALUE = "20px";

test.describe("CSS side effects", () => {
  let fixture: Fixture;
  let appFixture: AppFixture;

  test.beforeAll(async () => {
    fixture = await createFixture({
      files: {
        "remix.config.js": js`
          module.exports = {
            serverDependenciesToBundle: [/@test-package/],
            future: {
              // Enable all CSS future flags to
              // ensure features don't clash
              unstable_cssModules: true,
              unstable_cssSideEffects: true,
            },
          };
        `,
        "app/root.jsx": js`
          import { Links, Outlet } from "@remix-run/react";
          import { cssBundleHref } from "@remix-run/css-bundle";
          export function links() {
            return [{ rel: "stylesheet", href: cssBundleHref }];
          }
          export default function Root() {
            return (
              <html>
                <head>
                  <Links />
                </head>
                <body>
                  <Outlet />
                </body>
              </html>
            )
          }
        `,
        ...basicSideEffectFixture(),
        ...rootRelativeFixture(),
        ...commonJsPackageFixture(),
        ...esmPackageFixture(),
      },
    });
    appFixture = await createAppFixture(fixture);
  });

  test.afterAll(async () => {
    await appFixture.close();
  });

  let basicSideEffectFixture = () => ({
    "app/basicSideEffect.css": css`
      .global_basicSideEffect {
        background: peachpuff;
        padding: ${TEST_PADDING_VALUE};
      }
    `,
    "app/routes/basic-side-effect-test.jsx": js`
      import "../basicSideEffect.css";
      
      export default function() {
        return (
          <div data-testid="basic-side-effect" className="global_basicSideEffect">
            Basic side effect test
          </div>
        )
      }
    `,
  });
  test("basic side effect", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/basic-side-effect-test");
    let locator = await page.locator("[data-testid='basic-side-effect']");
    let padding = await locator.evaluate(
      (element) => window.getComputedStyle(element).padding
    );
    expect(padding).toBe(TEST_PADDING_VALUE);
  });

  let rootRelativeFixture = () => ({
    "app/rootRelative.css": css`
      .global_rootRelative {
        background: peachpuff;
        padding: ${TEST_PADDING_VALUE};
      }
    `,
    "app/routes/root-relative-test.jsx": js`
      import "~/rootRelative.css";
      
      export default function() {
        return (
          <div data-testid="root-relative" className="global_rootRelative">
            Root relative import test
          </div>
        )
      }
    `,
  });
  test("root relative", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/root-relative-test");
    let locator = await page.locator("[data-testid='root-relative']");
    let padding = await locator.evaluate(
      (element) => window.getComputedStyle(element).padding
    );
    expect(padding).toBe(TEST_PADDING_VALUE);
  });

  let commonJsPackageFixture = () => ({
    "node_modules/@test-package/commonjs/styles.css": css`
      .global_commonJsPackageStyles {
        background: peachpuff;
        padding: ${TEST_PADDING_VALUE};
      }
    `,
    "node_modules/@test-package/commonjs/index.js": js`
      var React = require('react');
      require('./styles.css');

      exports.Test = function() {
        return React.createElement(
          'div',
          {
            'data-testid': 'commonjs-package',
            'className': 'global_commonJsPackageStyles'
          },
          'CommonJS package test',
        );
      };
    `,
    "app/routes/commonjs-package-test.jsx": js`
      import { Test } from "@test-package/commonjs";
      export default function() {
        return <Test />;
      }
    `,
  });
  test("CommonJS package", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/commonjs-package-test");
    let locator = await page.locator("[data-testid='commonjs-package']");
    let padding = await locator.evaluate(
      (element) => window.getComputedStyle(element).padding
    );
    expect(padding).toBe(TEST_PADDING_VALUE);
  });

  let esmPackageFixture = () => ({
    "node_modules/@test-package/esm/styles.css": css`
      .global_esmPackageStyles {
        background: peachpuff;
        padding: ${TEST_PADDING_VALUE};
      }
    `,
    "node_modules/@test-package/esm/index.js": js`
      import React from 'react';
      import './styles.css';

      export function Test() {
        return React.createElement(
          'div',
          {
            'data-testid': 'esm-package',
            'className': 'global_esmPackageStyles'
          },
          'ESM package test',
        );
      };
    `,
    "app/routes/esm-package-test.jsx": js`
      import { Test } from "@test-package/esm";
      export default function() {
        return <Test />;
      }
    `,
  });
  test("ESM package", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/esm-package-test");
    let locator = await page.locator("[data-testid='esm-package']");
    let padding = await locator.evaluate(
      (element) => window.getComputedStyle(element).padding
    );
    expect(padding).toBe(TEST_PADDING_VALUE);
  });
});
