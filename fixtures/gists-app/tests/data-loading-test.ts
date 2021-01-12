import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";

import * as Utils from "./utils";

const testPort = 3000;
const testServer = `http://localhost:${testPort}`;

describe("data loading", () => {
  let browser: Browser;
  let page: Page;
  beforeEach(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  });

  afterEach(() => browser.close());

  describe("transitioning to a new route", () => {
    it("loads data for all routes on the page", async () => {
      await page.goto(`${testServer}/`);
      await Utils.reactIsHydrated(page);

      let responses = Utils.collectDataResponses(page);

      await page.click('a[href="/gists"]');
      await page.waitForSelector('[data-test-id="/gists/index"]');

      expect(responses.length).toEqual(2);
    });
  });

  describe("transitioning to a new route with a data loader that redirects", () => {
    it("redirects to the new page", async () => {
      await page.goto(`${testServer}/`);
      await Utils.reactIsHydrated(page);

      await page.click('a[href="/gists/mjijackson"]');
      await page.waitForSelector('[data-test-id="/gists/$username"]');

      expect(page.url()).toMatch(/\/gists\/mjackson$/);
    });
  });

  describe("transitioning back after a reload", () => {
    it("loads data for only the changed route", async () => {
      await page.goto(`${testServer}/gists`);
      await Utils.reactIsHydrated(page);

      await page.click('a[href="/gists/mjackson"]');
      await page.waitForSelector('[data-test-id="/gists/$username"]');

      await page.reload();
      await Utils.reactIsHydrated(page);

      let responses = Utils.collectDataResponses(page);

      await page.goBack();
      await page.waitForSelector('[data-test-id="/gists/index"]');

      expect(responses.length).toEqual(1);
    });
  });

  describe("transitioning forward to a page we have already seen", () => {
    it("loads data for only the changed route", async () => {
      await page.goto(`${testServer}/gists`);
      await Utils.reactIsHydrated(page);

      await page.click('a[href="/gists/mjackson"]');
      await page.waitForSelector('[data-test-id="/gists/$username"]');

      await page.goBack();
      await page.waitForSelector('[data-test-id="/gists/index"]');

      let responses = Utils.collectDataResponses(page);

      await page.goForward();
      await page.waitForSelector('[data-test-id="/gists/$username"]');

      expect(responses.length).toEqual(1);
    });
  });
});
