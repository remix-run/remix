import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";

import {
  reactIsHydrated,
  collectResponses,
  disableJavaScript,
  collectDataResponses
} from "./utils";

const testPort = 3000;
const testServer = `http://localhost:${testPort}`;

describe("route module link export", () => {
  let browser: Browser;
  let page: Page;
  beforeEach(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  });

  afterEach(() => browser.close());

  describe("route links export", () => {
    it("waits for new styles to load before transitioning", async () => {
      await page.goto(`${testServer}/`);
      await reactIsHydrated(page);

      let cssResponses = collectResponses(page, url =>
        url.pathname.endsWith(".css")
      );

      await page.click('a[href="/gists"]');
      await page.waitForSelector('[data-test-id="/gists/index"]');

      let [prefetched, loaded] = cssResponses;
      expect(cssResponses.length).toEqual(2);
      // same css file
      expect(prefetched.url()).toBe(loaded.url());
      // <link rel=prefetch>
      expect(prefetched.request().resourceType()).toBe("other");
      // <link rel=stylesheet>
      expect(loaded.request().resourceType()).toBe("stylesheet");
      expect(loaded.fromCache()).toBe(true);
    });

    it("adds links to the document", async () => {
      await disableJavaScript(page);
      let cssResponses = collectResponses(page, url =>
        url.pathname.endsWith(".css")
      );
      await page.goto(`${testServer}/links`);
      expect(cssResponses.length).toEqual(5);
    });

    it("preloads assets for other pages and serves from browser cache on navigation", async () => {
      await page.goto(`${testServer}/links`, { waitUntil: "networkidle0" });
      await reactIsHydrated(page);

      let jsResponses = collectResponses(page, url =>
        url.pathname.endsWith(".js")
      );

      await page.click('a[href="/gists/ryanflorence"]');
      await page.waitForSelector('[data-test-id="/gists/$username"]');

      expect(jsResponses.every(res => res.fromCache())).toBe(true);
    });

    it("preloads data for other pages and serves from browser cache on navigation", async () => {
      let dataResponses = collectDataResponses(page);
      await page.goto(`${testServer}/links`, { waitUntil: "networkidle0" });
      await reactIsHydrated(page);

      expect(dataResponses.length).toBe(2);
      let [prefetchGists, prefetchUser] = dataResponses;
      expect(prefetchGists.request().resourceType()).toBe("other");
      expect(prefetchUser.request().resourceType()).toBe("other");

      await page.click('a[href="/gists/mjackson"]');
      await page.waitForSelector('[data-test-id="/gists/$username"]');

      expect(dataResponses.length).toBe(4);
      let [, , gists, username] = dataResponses;
      expect(gists.request().resourceType()).toBe("fetch");
      expect(gists.fromCache()).toBe(true);
      expect(username.fromCache()).toBe(true);
    });
  });
});
