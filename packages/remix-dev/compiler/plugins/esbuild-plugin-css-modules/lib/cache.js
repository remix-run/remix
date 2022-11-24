// Local patched copy of https://github.com/indooorsman/esbuild-css-modules-plugin
// More details in readme and license included in plugin's root directory

/* eslint-disable */
import { readFile } from "fs/promises";
class BuildCache {
  /**
   * @param {import('..').Build} build
   */
  constructor(build) {
    this.build = build;
    /**
     * @type {import('..').Build['context']['log']}
     */
    this.log = build.context.log;
    /**
     * @type {Map<string, {result: import('esbuild').OnLoadResult; input: string}}
     */
    this.cache = new Map();
  }
  /**
   * @param {string} absPath
   * @returns {Promise<import('esbuild').OnLoadResult|void>}
   */
  async get(absPath) {
    const cachedData = this.cache.get(absPath);
    if (cachedData) {
      this.log(
        `find cache data, check if content changed(${this.build.context.relative(
          absPath
        )})...`
      );
      const input = await readFile(absPath, { encoding: "utf8" });
      if (input === cachedData.input) {
        this.log(
          `content not changed, return cache(${this.build.context.relative(
            absPath
          )})`
        );
        return cachedData.result;
      }
      this.log(
        `content changed(${this.build.context.relative(
          absPath
        )}), rebuilding...`
      );
      return void 0;
    }
    this.log(
      `cache data not found(${this.build.context.relative(
        absPath
      )}), building...`
    );
    return void 0;
  }
  /**
   * @param {string} absPath
   * @param {import('esbuild').OnLoadResult} result
   * @param {string} originContent
   * @returns {Promise<void>}
   */
  async set(absPath, result, originContent) {
    const m = process.memoryUsage().rss;
    if (m / 1024 / 1024 > 250) {
      this.log("memory usage > 250M");
      this.clear();
    }
    const input =
      originContent || (await readFile(absPath, { encoding: "utf8" }));
    this.cache.set(absPath, { input, result });
  }
  clear() {
    this.log("clear cache");
    this.cache.clear();
  }
}

export default BuildCache;
