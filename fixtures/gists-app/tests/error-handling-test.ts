import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";

import { reactIsHydrated, getHtml } from "./utils";

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

  describe("render errors", () => {
    it("renders the uncaught exception page on fetch requests", async () => {
      await page.goto(`${testServer}/`);
      await reactIsHydrated(page);
      await page.click('a[href="/render-error"]');
      await page.waitForSelector("#remix-uncaught-error");
      expect(await getHtml(page, "main")).toMatchSnapshot();
    });
  });
});
