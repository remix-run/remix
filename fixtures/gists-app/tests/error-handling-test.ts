import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";

import * as Utils from "./utils";

const testPort = 3000;
const testServer = `http://localhost:${testPort}`;

describe("uncaught exceptions", () => {
  let browser: Browser;
  let page: Page;
  beforeEach(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  });

  afterEach(() => browser.close());

  describe("an uncaught render error", () => {
    describe("on a route without an ErrorBoundary", () => {
      it("renders the root ErrorBoundary on document requests", async () => {
        await page.goto(`${testServer}/render-errors?throw`);
        expect(await Utils.getHtml(page, '[data-test-id="app-error-boundary"]'))
          .toMatchInlineSnapshot(`
          "<div data-test-id=\\"app-error-boundary\\">
            <h1>Oh snizzy, there was an error</h1>
            <pre>Explosions!!!! &#x1F4A3;</pre>
          </div>
          "
        `);
      });

      it("renders root ErrorBoundary on fetch requests", async () => {
        await page.goto(`${testServer}/`);
        await Utils.reactIsHydrated(page);
        await page.click('a[href="/render-errors?throw"]');
        await page.waitForSelector('[data-test-id="app-error-boundary"]');
        expect(await Utils.getHtml(page, '[data-test-id="app-error-boundary"]'))
          .toMatchInlineSnapshot(`
          "<div data-test-id=\\"app-error-boundary\\">
            <h1>Oh snizzy, there was an error</h1>
            <pre>Explosions!!!! &#x1F4A3;</pre>
          </div>
          "
        `);
      });
    });

    describe("on a route with an ErrorBoundary", () => {
      it("renders the route ErrorBoundary on document requests", async () => {
        await page.goto(`${testServer}/render-errors/nested`);
        expect(
          await Utils.getHtml(page, '[data-test-id="/render-errors"]')
        ).toMatchInlineSnapshot();
      });

      it("renders the route ErrorBoundary on fetch requests", async () => {
        await page.goto(`${testServer}/`);
        await Utils.reactIsHydrated(page);
        await page.click('a[href="/render-errors/nested"]');
        await page.waitForSelector('[data-test-id="/render-errors/nested"]');
        expect(
          await Utils.getHtml(page, '[data-test-id="/render-errors"]')
        ).toMatchInlineSnapshot();
      });
    });
  });
});
