import { resolve, normalize } from 'path'
import fs from 'fs-extra'
import type { Metafile } from 'esbuild';

import type { Context } from "../context";
import invariant from "../../invariant";


const genMetaFile = (name: string) => `${name}.json`

const getMetaPath = (target: string, filename: string) => normalize(resolve(target, filename));



/**
 * Generate metafile for esbuild analyze
 * @returns 
 */
const createBrowserMetaFile = (ctx: Context, name: string, metafile: Metafile) => {
  let { debugDirectory } = ctx.config

  if (metafile) {

    let metafileName = genMetaFile(name)

    try {
      let output = getMetaPath(debugDirectory, metafileName);
      if (!fs.existsSync(debugDirectory)) {
        fs.mkdirSync(debugDirectory)
      }
      return fs.writeFile(normalize(output), JSON.stringify(metafile));
    } catch (e) {
      invariant(e, `Failed to generate ${metafileName} in ${debugDirectory}.`);
    }
  }
}

export {
  createBrowserMetaFile
}
