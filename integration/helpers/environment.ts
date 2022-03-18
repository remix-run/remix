import os from "os";
import path from "path";
import puppeteer from "puppeteer";
import NodeEnvironment from "jest-environment-node";
import type { ProjectConfig } from "@jest/types/build/Config";

const { readFile } = require("fs").promises;

const DIR = path.join(os.tmpdir(), "jest_puppeteer_global_setup");

export class PuppeteerEnvironment extends NodeEnvironment {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(config: ProjectConfig) {
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
}
