import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";

import { reactIsHydrated, collectResponses } from "./utils";

const testPort = 3000;
const testServer = `http://localhost:${testPort}`;

describe("style loading", () => {
  let browser: Browser;
  let page: Page;
  beforeEach(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  });

  afterEach(() => {
    return browser.close();
  });

  describe("transitioning to a new route", () => {
    it("waits for new styles to load before transitioning", async () => {
      await page.goto(`${testServer}/`);
      await reactIsHydrated(page);

      let cssResponses = collectResponses(page, url =>
        /routes\/gists-[a-z0-9]+\.css/.test(url.pathname)
      );

      await page.click('a[href="/gists"]');
      await page.waitForSelector('[data-test-id="/gists/index"]');

      // first response is the preload in the transition
      // second response is the <link> from <Styles>
      expect(cssResponses.length).toBe(2);
    });
  });
});
