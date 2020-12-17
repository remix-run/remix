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
        await page.goto(`${testServer}/errors?throw`);
        expect(
          await Utils.getHtml(page, '[data-test-id="error-page"]')
        ).toMatchSnapshot();
      });

      it("renders root ErrorBoundary on fetch requests", async () => {
        await page.goto(`${testServer}/`);
        await Utils.reactIsHydrated(page);
        await page.click('a[href="/errors?throw"]');
        await page.waitForSelector('[data-test-id="error-page"]');
        expect(
          await Utils.getHtml(page, '[data-test-id="error-page"]')
        ).toMatchSnapshot();
      });
    });

    describe("on a route with an ErrorBoundary", () => {
      it("renders the route ErrorBoundary on document requests", async () => {
        await page.goto(`${testServer}/errors/nested`);
        expect(
          await Utils.getHtml(page, '[data-test-id="/errors/nested"]')
        ).toMatchSnapshot();
      });

      it("renders the route ErrorBoundary on fetch requests", async () => {
        await page.goto(`${testServer}/`);
        await Utils.reactIsHydrated(page);
        await page.click('a[href="/errors/nested"]');
        await page.waitForSelector('[data-test-id="/errors/nested"]');
        expect(
          await Utils.getHtml(page, '[data-test-id="/errors/nested"]')
        ).toMatchSnapshot();
      });
    });
  });
});
