import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";

import { reactIsHydrated, disableJavaScript } from "./utils";

const testPort = 3000;
const testServer = `http://localhost:${testPort}`;

describe("resource routes", () => {
  let browser: Browser;
  let page: Page;
  beforeEach(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  });

  afterEach(() => browser.close());

  describe("redirect", () => {
    it("with javascript enabled", async () => {
      await page.goto(`${testServer}/resources`);
      await reactIsHydrated(page);

      await page.click('a[href="/resources/redirect"]');

      await page.waitForSelector('[data-test-id="/"]');
    });

    it("with javascript disabled", async () => {
      await disableJavaScript(page);
      await page.goto(`${testServer}/resources`);

      await page.click('a[href="/resources/redirect"]');

      await page.waitForSelector('[data-test-id="/"]');
    });
  });

  describe("<Link> to resource route", () => {
    it("with javascript enabled end up in error boundary", async () => {
      await page.goto(`${testServer}/resources`);
      await reactIsHydrated(page);

      await page.click('a[href="/resources/theme-css"]');

      await page.waitForSelector('[data-test-id="app-error-boundary"]');

      let response = await page.reload();
      expect(response!.headers()["content-type"]).toBe(
        "text/css; charset=UTF-8"
      );
    });

    it("with javascript disabled loads resource", async () => {
      await disableJavaScript(page);
      await page.goto(`${testServer}/resources`);

      let responsePromise = page.waitForResponse(
        `${testServer}/resources/theme-css`
      );
      await page.click('a[href="/resources/theme-css"]');
      let response = await responsePromise;
      expect(response.headers()["content-type"]).toBe(
        "text/css; charset=UTF-8"
      );
    });
  });
});
