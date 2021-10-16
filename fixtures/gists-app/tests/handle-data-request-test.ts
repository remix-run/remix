import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";

import * as Utils from "./utils";

const testPort = 3000;
const testServer = `http://localhost:${testPort}`;

describe("handle data request function", () => {
  let browser: Browser;
  let page: Page;
  beforeEach(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  });

  afterEach(() => browser.close());

  describe("is called", () => {
    it("on client side navigation", async () => {
      let responses = Utils.collectDataResponses(page);
      await page.goto(`${testServer}/`);
      await Utils.reactIsHydrated(page);

      await page.click('a[href="/gists"]');
      await page.waitForSelector('[data-test-id="/gists/index"]');

      expect(responses.length).toEqual(2);
      responses.forEach(response =>
        expect(response.headers()["x-hdr"]).toBe("yes")
      );
    });
  });
});
