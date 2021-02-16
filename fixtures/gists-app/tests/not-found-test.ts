import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";

import * as Utils from "./utils";

const testPort = 3000;
const testServer = `http://localhost:${testPort}`;

describe("the not found page", () => {
  let browser: Browser;
  let page: Page;
  beforeEach(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  });

  afterEach(() => browser.close());

  describe("the server render", () => {
    it("is correct", async () => {
      let res = await page.goto(`${testServer}/NOT_FOUND`);

      expect(res?.status()).toEqual(404);

      await Utils.disableJavaScript(page);

      expect(await Utils.getHtml(page, '[data-test-id="404"]'))
        .toMatchInlineSnapshot(`
        "<div data-test-id=\\"404\\"><h1>404</h1></div>
        "
      `);
    });
  });

  describe("the client render", () => {
    it("is correct", async () => {
      await page.goto(`${testServer}/NOT_FOUND`);
      await Utils.reactIsHydrated(page);
      expect(await Utils.getHtml(page, '[data-test-id="404"]'))
        .toMatchInlineSnapshot(`
        "<div data-test-id=\\"404\\"><h1>404</h1></div>
        "
      `);
    });
  });
});
