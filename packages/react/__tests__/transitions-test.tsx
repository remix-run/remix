import type { Page } from "puppeteer";
import puppeteer from "puppeteer";

import { prettyHtml } from "../../core/__tests__/utils";

function reactIsHydrated(page: Page) {
  return page.waitForFunction("window.reactIsHydrated === true");
}

describe("route transitions", () => {
  describe("transitioning to a new route with data", () => {
    it("works", async () => {
      let browser = await puppeteer.launch();
      let page = await browser.newPage();
      await page.goto("http://localhost:3000");
      await reactIsHydrated(page);
      let content = await page.content();

      expect(prettyHtml(content)).toMatchSnapshot();

      await page.click('a[href="/gists"]');
      await page.waitForSelector('[data-test-id="/gists/index"]');
      content = await page.content();

      expect(prettyHtml(content)).toMatchSnapshot();

      return browser.close();
    });
  });

  describe("transitioning back after a reload", () => {
    it("works", async () => {
      let browser = await puppeteer.launch();
      let page = await browser.newPage();
      await page.goto("http://localhost:3000/gists");
      await reactIsHydrated(page);
      let content = await page.content();

      expect(prettyHtml(content)).toMatchSnapshot();

      await page.click('a[href="/gists/mjackson"]');
      await page.waitForSelector('[data-test-id="/gists/$username"]');
      content = await page.content();

      expect(prettyHtml(content)).toMatchSnapshot();

      await page.reload();
      await reactIsHydrated(page);

      await page.goBack();
      await page.waitForSelector('[data-test-id="/gists"]');
      content = await page.content();

      expect(prettyHtml(content)).toMatchSnapshot();
    });
  });
});
