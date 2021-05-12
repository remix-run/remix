import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";

import { reactIsHydrated, collectResponses, disableJavaScript } from "./utils";

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

      expect(cssResponses.length).toEqual(1);
    });

    it("does not wait for styles that don't match the window media", async () => {
      await page.goto(`${testServer}/`);
      await reactIsHydrated(page);

      let cssResponses = collectResponses(page, url =>
        url.pathname.endsWith(".css")
      );

      await page.click('a[href="/links"]');
      await page.waitForSelector('[data-test-id="/links"]');

      // the browser loads both links, but it doesn't parse, apply, or call
      // `link.onload` of links that don't match the media query, so we have "2"
      // here even though we only blocked on 1. The fact we got here means the
      // browser didn't hang forever waiting for `link.onload` of the stylesheet
      // that doesn't match, telling us the code works as expected.
      expect(cssResponses.length).toEqual(4);
    });

    it("adds links to the document", async () => {
      await disableJavaScript(page);
      let cssResponses = collectResponses(page, url =>
        url.pathname.endsWith(".css")
      );
      await page.goto(`${testServer}/links`);
      expect(cssResponses.length).toEqual(5);
    });

    it("waits for new styles to load before transitioning", async () => {
      await page.goto(`${testServer}/`);
      await reactIsHydrated(page);

      let cssResponses = collectResponses(page, url =>
        url.pathname.endsWith(".css")
      );

      await page.click('a[href="/gists"]');
      await page.waitForSelector('[data-test-id="/gists/index"]');

      expect(cssResponses.length).toEqual(1);
    });

    it.skip("preloads, blocks, and prevents layout shift with images", async () => {
      await page.goto(`${testServer}/`, { waitUntil: "networkidle0" });
      await reactIsHydrated(page);

      const client = await page.target().createCDPSession();
      let network3G = {
        offline: false,
        downloadThroughput: (750 * 1024) / 8,
        uploadThroughput: (250 * 1024) / 8,
        latency: 100
      };
      await client.send("Network.emulateNetworkConditions", network3G);

      await page.click('a[href="/links"]');
      await page.waitForSelector('[data-test-id="/links"]');

      let blockedImage = await page.$('[data-test-id="blocked"]');
      let box = await blockedImage?.boundingBox();
      expect(box?.width).toEqual(500);
      expect(box?.height).toEqual(500);

      let notBlockedImage = await page.$('[data-test-id="not-blocked"]');
      let box2 = await notBlockedImage?.boundingBox();
      expect(box2?.height).toBeLessThan(600);
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
      await page.goto(`${testServer}/links`, { waitUntil: "networkidle0" });
      await reactIsHydrated(page);

      let fetchResponses = collectResponses(page, url =>
        url.searchParams.has("_data")
      );

      await page.click('a[href="/gists/mjackson"]');
      await page.waitForSelector('[data-test-id="/gists/$username"]');

      // one for /gists
      // one for /gists/$username
      expect(fetchResponses.length).toBe(2);
      expect(fetchResponses.every(res => res.fromCache())).toBe(true);
    });
  });
});
