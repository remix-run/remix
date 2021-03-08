import * as path from "path";
import type { Plugin } from "rollup";
import sharp from "sharp";

import { BuildTarget } from "../../build";
import { addHash, getFileHash, getHash } from "../crypto";
import type { RemixConfig } from "./remixConfig";
import { getRemixConfig } from "./remixConfig";

// Don't use the sharp cache, we use Rollup's built-in cache so we don't process
// images between restarts of the dev server. Also, through some experimenting,
// the sharp cache seems to be based on filenames, not the content of the file,
// so replacing an image with a new one by the same name didn't work.
sharp.cache(false);

export default function imgPlugin({ target }: { target: string }): Plugin {
  let config: RemixConfig;

  return {
    name: "img",

    async buildStart({ plugins }) {
      config = await getRemixConfig(plugins);
    },

    async resolveId(id, importer) {
      if (id[0] === "\0" || !id.startsWith("img:")) return;
      id = id.slice(4);

      let { baseId, search } = parseId(id);

      let resolved = await this.resolve(baseId, importer, { skipSelf: true });

      return resolved && `\0img:${resolved.id}${search}`;
    },

    async load(id) {
      if (!id.startsWith("\0img:")) return;
      id = id.slice(5);

      let { baseId, search } = parseId(id);

      this.addWatchFile(baseId);

      let hash = await getFileHash(baseId);
      let mod = await getImageModule(
        config.appDirectory,
        baseId,
        hash,
        new URLSearchParams(search),
        config.publicPath
      );

      return mod;
    },

    async transform(code, id) {
      if (target !== BuildTarget.Browser) return;

      if (!id.startsWith("\0img:")) return;
      id = id.slice(5);

      let { baseId, search } = parseId(id);

      let hash = await getFileHash(baseId);
      let assets = await getImageAssets(
        config.appDirectory,
        baseId,
        hash,
        new URLSearchParams(search)
      );

      for (let asset of assets) {
        this.emitFile({
          type: "asset",
          fileName: asset.fileName,
          source: await generateImageAssetSource(baseId, asset)
        });
      }

      return code;
    }
  };
}

function parseId(id: string): { baseId: string; search: string } {
  let searchIndex = id.indexOf("?");
  return searchIndex === -1
    ? { baseId: id, search: "" }
    : {
        baseId: id.slice(0, searchIndex),
        search: id.slice(searchIndex)
      };
}

const transparent1x1gif =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=";

async function getImageModule(
  dir: string,
  file: string,
  hash: string,
  params: URLSearchParams,
  publicPath: string
): Promise<string> {
  let assets = await getImageAssets(dir, file, hash, params);

  // Although we can defer generating asset sources until later, we have to
  // generate the placeholder source here because it is inlined in the image
  // module as a `data:` URI.
  let placeholder =
    params.get("placeholder") != null
      ? await generateImagePlaceholder(file, hash)
      : transparent1x1gif;

  let images = assets.map(asset => ({
    src: publicPath + asset.fileName,
    width: asset.width,
    height: asset.height,
    format: asset.transform.format
  }));

  return `
    export let images = ${JSON.stringify(images, null, 2)};
    let primaryImage = images[images.length - 1];
    let srcset = images.map(image => image.src + " " + image.width + "w").join(",");
    let placeholder = ${JSON.stringify(placeholder)};
    let mod = { ...primaryImage, srcset, placeholder };
    export default mod;
  `;
}

const imageFormats = ["avif", "jpeg", "png", "webp"];

interface ImageTransform {
  width?: number;
  height?: number;
  quality?: number;
  format: string;
}

function getImageTransforms(
  params: URLSearchParams,
  defaultFormat: string
): ImageTransform[] {
  let width = params.get("width");
  let height = params.get("height");
  let quality = params.get("quality");
  let format = params.get("format") || defaultFormat;

  if (format === "jpg") {
    format = "jpeg";
  } else if (!imageFormats.includes(format)) {
    throw new Error(`Invalid image format: ${format}`);
  }

  let transform = {
    width: width ? parseInt(width, 10) : undefined,
    height: height ? parseInt(height, 10) : undefined,
    quality: quality ? parseInt(quality, 10) : undefined,
    format
  };

  let srcset = params.get("srcset");

  return srcset
    ? srcset.split(",").map(width => ({
        ...transform,
        width: parseInt(width, 10)
      }))
    : [transform];
}

interface ImageAsset {
  fileName: string;
  width: number;
  height: number;
  transform: ImageTransform;
}

async function getImageAssets(
  dir: string,
  file: string,
  hash: string,
  params: URLSearchParams
): Promise<ImageAsset[]> {
  let defaultFormat = path.extname(file).slice(1);
  let transforms = getImageTransforms(params, defaultFormat);

  return Promise.all(
    transforms.map(async transform => {
      let width: number;
      let height: number;

      if (transform.width && transform.height) {
        width = transform.width;
        height = transform.height;
      } else {
        let meta = await sharp(file).metadata();

        if (transform.width) {
          width = transform.width;
          height = Math.round(transform.width / (meta.width / meta.height));
        } else if (transform.height) {
          width = Math.round(transform.height / (meta.height / meta.width));
          height = transform.height;
        } else {
          width = meta.width;
          height = meta.height;
        }
      }

      let fileName = addHash(
        addHash(path.relative(dir, file), `${width}x${height}`),
        getHash(
          hash +
            transform.width +
            transform.height +
            transform.quality +
            transform.format
        ).slice(0, 8)
      );

      return { fileName, width, height, transform };
    })
  );
}

async function generateImageAssetSource(
  file: string,
  asset: ImageAsset
): Promise<Buffer> {
  console.log(`generating image asset for ${file} (${asset.fileName})`);

  let image = sharp(file);

  if (asset.width || asset.height) {
    image.resize({ width: asset.width, height: asset.height });
  }

  // image.jpeg(), image.png(), etc.
  image[asset.transform.format]({ quality: asset.transform.quality });

  return image.toBuffer();
}

// We can't use Rollup for caching placeholders because we need to inline them
// in the image module in `load()` (instead of generating a separate asset). So
// we keep this local cache to speed up the build.
const placeholderCache: { [imageHash: string]: string } = {};

async function generateImagePlaceholder(
  file: string,
  hash: string
): Promise<string> {
  let placeholder = placeholderCache[hash];

  if (!placeholder) {
    console.log(`generating placeholder image for ${file}`);
    let image = sharp(file).resize({ width: 50 }).jpeg({ quality: 25 });
    let buffer = await image.toBuffer();
    placeholder = `data:image/jpeg;base64,${buffer.toString("base64")}`;
    placeholderCache[hash] = placeholder;
  }

  return placeholder;
}
