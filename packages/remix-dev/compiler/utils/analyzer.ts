import { resolve, normalize } from 'path'
import fs from 'fs-extra'
import type { Metafile } from 'esbuild';

import type { Context } from "../context";
import invariant from "../../invariant";


const JS_META_FILE_NAME = 'browser-metafile.json';


const getMetaPath = (target: string, filename: string) => normalize(resolve(target, filename));

/**
 * Generate metafile for esbuild analyze
 * @returns 
 */
const createMetaFile = (ctx: Context) => {
  let {
    config
  } = ctx;
  let {
    metafile,
    debugDirectory
  } = config
  return {
    createBrowserMetaFile: (outputMeta?: Metafile) => {
      if (metafile && outputMeta) {
        try {
          let output = getMetaPath(debugDirectory, JS_META_FILE_NAME);
          if (!fs.existsSync(debugDirectory)) {
            fs.mkdirSync(debugDirectory)
          }
          return fs.writeFile(normalize(output), JSON.stringify(outputMeta));
        } catch (e) {
          invariant(e, `Failed to generate ${JS_META_FILE_NAME} in ${debugDirectory}.`);
        }
      }
    }
  }
}

export default createMetaFile

