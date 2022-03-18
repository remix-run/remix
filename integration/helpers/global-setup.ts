import fs from "fs/promises";
import path from "path";
import os from "os";
import puppeteer from "puppeteer";

export const TMP_DIR = path.join(process.cwd(), ".tmp");
const PUPPETEER_TMP_DIR = path.join(os.tmpdir(), "jest_puppeteer_global_setup");

// TODO: get rid of React Router `console.warn` when no routes match when testing
console.warn = () => {};

declare global {
  // eslint-disable-next-line prefer-let/prefer-let
  var __BROWSER_GLOBAL__: puppeteer.Browser;
}

export default async function setup() {
  await fs.rm(TMP_DIR, {
    force: true,
    recursive: true,
  });
  await fs.mkdir(TMP_DIR);

  // https://jestjs.io/docs/puppeteer#custom-example-without-jest-puppeteer-preset
  let browser = await puppeteer.launch();
  // store the browser instance so we can teardown it later
  // this global is only available in the teardown but not in TestEnvironments
  global.__BROWSER_GLOBAL__ = browser;

  // use the file system to expose the wsEndpoint for TestEnvironments
  await fs.mkdir(PUPPETEER_TMP_DIR, { recursive: true });
  await fs.writeFile(
    path.join(PUPPETEER_TMP_DIR, "wsEndpoint"),
    browser.wsEndpoint()
  );
}
