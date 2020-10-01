import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";

import { prettyHtml, reactIsHydrated, collectResponses } from "./utils";

const testPort = 3000;
const testServer = `http://localhost:${testPort}`;

describe("data loading", () => {
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
    it("loads data for the new route", async () => {
      await page.goto(testServer);
      await reactIsHydrated(page);

      expect(prettyHtml(await page.content())).toMatchSnapshot();

      let dataResponses = collectResponses(
        page,
        url => url.pathname === "/__remix_data"
      );

      await page.click('a[href="/gists"]');
      await page.waitForSelector('[data-test-id="/gists/index"]');

      expect(dataResponses.length).toEqual(2);
      expect(prettyHtml(await page.content())).toMatchSnapshot();
    });
  });

  describe("transitioning back after a reload", () => {
    it("loads data for the previous route", async () => {
      await page.goto(`${testServer}/gists`);
      await reactIsHydrated(page);

      expect(prettyHtml(await page.content())).toMatchSnapshot();

      let dataResponses = collectResponses(
        page,
        url => url.pathname === "/__remix_data"
      );

      await page.click('a[href="/gists/mjackson"]');
      await page.waitForSelector('[data-test-id="/gists/$username"]');

      expect(dataResponses.length).toEqual(1);
      expect(prettyHtml(await page.content())).toMatchSnapshot();

      await page.reload();
      await reactIsHydrated(page);

      dataResponses = collectResponses(
        page,
        url => url.pathname === "/__remix_data"
      );

      await page.goBack();
      await page.waitForSelector('[data-test-id="/gists/index"]');

      expect(dataResponses.length).toEqual(1);
      expect(prettyHtml(await page.content())).toMatchSnapshot();
    });
  });
});
