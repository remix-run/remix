import { resolve } from 'path'
import fs from 'fs-extra'
import type { Metafile } from 'esbuild';

import type { Context } from "../context";
import invariant from "../../invariant";


const JS_META_FILE_NAME = 'remix-js-metafile.json';


const getMetaPath = (target: string, filename: string) => resolve(target, filename);

/**
 * Generate metafile for esbuild analyze
 * @returns 
 */
const createMetaFile = (ctx: Context) => {
  let {
    config
  } = ctx;
  let {
    browserMeta,
    assetsBuildDirectory
  } = config
  return {
    createBrowserMetaFile: (outputMeta?: Metafile) => {
      if (browserMeta && outputMeta) {
        try {
          let output = getMetaPath(assetsBuildDirectory, JS_META_FILE_NAME);
          return fs.writeFile(output, JSON.stringify(outputMeta));
        } catch (e) {
          invariant(e, `Failed to generate ${JS_META_FILE_NAME}.`);
        }
      }
    }
  }
}

export default createMetaFile

