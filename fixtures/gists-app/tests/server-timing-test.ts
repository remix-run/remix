import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";
import { collectDataResponses, reactIsHydrated } from "./utils";

const testPort = 3000;
const testServer = `http://localhost:${testPort}`;

describe("Server-Timing Header results", () => {
  let browser: Browser;
  let page: Page;
  beforeEach(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  });

  afterEach(() => browser.close());

  describe("document request", () => {
    it("has Server-Timing for all loaders", async () => {
      let res = await page.goto(`${testServer}/gists/mjackson`);
      const serverTiming = res.headers()["server-timing"];
      expect(serverTiming).toBeDefined();

      const timings = serverTiming.split(", ");

      // root loader, layout loader, child loader
      expect(timings.length).toBe(3);
    });

    describe("user sets custom server-timing in loader", () => {
      it("merges with framework headers", async () => {
        let res = await page.goto(`${testServer}/gists`);
        const serverTiming = res.headers()["server-timing"];
        expect(serverTiming).toBeDefined();

        const timings = serverTiming.split(", ");

        // root loader, layout loader, child loader, custom server-timing
        expect(timings.length).toBe(4);
        expect(serverTiming).toContain("anything;dur=20");
      });
    });

    describe("user uses exposed time function in loader", () => {
      it("merges with framework headers", async () => {
        let res = await page.goto(`${testServer}/gists/mine`);
        const serverTiming = res.headers()["server-timing"];
        expect(serverTiming).toBeDefined();

        const timings = serverTiming.split(", ");

        // root loader (1), gists.mine loader (2) with exposed time function (3)
        expect(timings.length).toBe(3);

        expect(serverTiming).toContain(
          `;desc="gists-app-routes-gists-mine-jsx-loader"`
        );
      });
    });
  });

  describe("data request", () => {
    it("has Server-Timing for all loaders", async () => {
      await page.goto(`${testServer}/gists`);
      await reactIsHydrated(page);

      let responses = collectDataResponses(page);

      await page.click('a[href="/gists/mjackson"]');
      await page.waitForSelector('[data-test-id="/gists/$username"]');

      // new /gists/$username loader data
      expect(responses.length).toEqual(1);

      responses.forEach(response => {
        const serverTiming = response.headers()["server-timing"];
        expect(serverTiming).toBeDefined();
        const timings = serverTiming.split(", ");

        // each loader has it's own timing
        expect(timings.length).toBe(1);
      });
    });

    describe("user sets custom server-timing in loader", () => {
      it("merges with framework headers", async () => {
        await page.goto(`${testServer}/gists/mjackson`);
        await reactIsHydrated(page);

        let responses = collectDataResponses(page);

        await page.click('a[href="/gists"]');
        await page.waitForSelector('[data-test-id="/gists/index"]');

        // gists/$username.tsx;
        expect(responses.length).toEqual(1);

        const [response] = responses;
        const serverTiming = response.headers()["server-timing"];

        expect(serverTiming).toContain("anything;dur=20");
      });
    });

    describe("user uses exposed time function in loader", () => {
      it("merges with framework headers", async () => {
        await page.goto(`${testServer}/gists/mjackson`);
        await reactIsHydrated(page);

        let responses = collectDataResponses(page);

        await page.click('a[href="/gists/mine"]');
        await page.waitForSelector('[data-test-id="/gists/mine"]');

        // gists/mine.tsx;
        expect(responses.length).toEqual(1);

        const [response] = responses;
        const serverTiming = response.headers()["server-timing"];

        expect(serverTiming).toContain(
          `;desc="gists-app-routes-gists-mine-jsx-loader"`
        );
      });
    });
  });
});
