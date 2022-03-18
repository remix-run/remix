const os = require("os");
const path = require("path");
const puppeteer = require("puppeteer");
const NodeEnvironment = require("jest-environment-node");
const { readFile } = require("fs").promises;

const DIR = path.join(os.tmpdir(), "jest_puppeteer_global_setup");

module.exports = class PuppeteerEnvironment extends NodeEnvironment {
  // eslint-disable-next-line no-useless-constructor
  constructor(config) {
    super(config);
  }

  async setup() {
    await super.setup();
    // get the wsEndpoint
    let wsEndpoint = await readFile(path.join(DIR, "wsEndpoint"), "utf8");
    if (!wsEndpoint) {
      throw new Error("wsEndpoint not found");
    }

    // connect to puppeteer
    this.global.__BROWSER_GLOBAL__ = await puppeteer.connect({
      browserWSEndpoint: wsEndpoint,
    });
  }

  async teardown() {
    await super.teardown();
  }

  getVmContext() {
    return super.getVmContext();
  }
};
