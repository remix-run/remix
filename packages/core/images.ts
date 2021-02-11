// dev build:
// - URLs point to the remix express app
// - express app serves from `.img-cache`
// - after building, clean up any files not used
//
// production build:
// - URLs point to public directory
// - try to copy from `.img-cache`
//   - otherwise build

import { createHash } from "crypto";
import { promises as fsp } from "fs";
import path from "path";
import sharp from "sharp";
import prettyBytes from "pretty-bytes";
import prettyMs from "pretty-ms";

import type { RemixConfig } from "./config";

// Don't use the sharp cache, we use the config.browserBuildDirectory as the
// cache so that we don't process images even between restarts of the dev
// server. Also, through some experimenting, the sharp cache seems to be based
// on filenames, not the content of the file, so replacing an image with a new
// one by the same name didn't work.
sharp.cache(false);

/**
 * Description of an image to build into multiple assets and define the
 * exported module. This is all derived without processing any images.
 */
interface BuildImage {
  /**
   * The relative name of the source file (to `config.appDirectory`).
   */
  name: string;

  /**
   * Base64 placeholder. Can be inlined to the server and browser modules so it
   * needs to be transformed in both builds. Defaults to transparent 1x1 gif.
   */
  placeholder: string;

  /**
   * Hash of the image metadata, it's way faster than reading the file and
   * hashing it and should be pretty dang unique, if not, we can read the file
   * and hash its contents instead.
   */
  metaHash: string;

  /**
   * When an image is processed there are multiple transforms for srcset.
   */
  transforms: Transform[];
}

/**
 * Description of an individual image to be emitted during the build, these
 * are all derived without processing any images.
 */
interface BuildImageAsset {
  /**
   * Name of the source file relative to the config.appDirectory
   */
  sourceName: string;

  /**
   * The relative BuildImage name with a unique hash made up of:
   *
   * - the Transform (makes it unique to sibling assets)
   * - the source image metaHash (unique to older image of the same name)
   *
   * This name will be unique for the source asset including newer (or older)
   * version of the source file or different transform arguments.
   *
   * Normally we'd let rollup hash the file based on content, but by generating
   * the name ourselves we can try to read it from the
   * `config.browserBuildDirectory` directory if its already been processed.
   */
  name: string;

  /**
   * The image format.
   */
  format: ImageAsset["format"];

  /**
   * The image width in pixels
   */
  width: number;

  /**
   * The image height in pixels
   */
  height: number;

  transform: Transform;
}

/**
 * Instructions for a Remix flavored transform sent to sharp
 */
interface Transform {
  format: "jpeg" | "png" | "webp" | "avif";
  width?: number;
  height?: number;
  quality?: number;
}

/**
 * Creates the ImageAsset module and emits the image assets for an image import.
 */
export async function getImageAssetModule(
  id: string, // image import id like "./something.jpg?placeholder&width=500"
  config: RemixConfig,
  emit: boolean = false
) {
  let buildImage = await getBuildImage(id, config);
  let assets = await getBuildImageAssets(buildImage, config);

  if (emit) {
    await Promise.all(assets.map(asset => emitAsset(asset, config)));
  }

  return `
    export let images = [
      ${assets.map(
        asset => `
          {
            src: ${JSON.stringify(config.publicPath + asset.name)},
            width: ${asset.width},
            height: ${asset.height},
            format: "${asset.format}",
          }
        `
      )}
    ]
    let srcset = images.map(image => image.src + " " + image.width+"w").join(",");
    let placeholder = ${JSON.stringify(buildImage.placeholder)}
    let primaryImage = images[images.length - 1];
    let mod = { ...primaryImage, srcset, placeholder };
    export default mod;
  `;
}

export async function getBuildImage(
  id: string,
  config: RemixConfig
): Promise<BuildImage> {
  let [sourceFileName, search] = id.split("?");

  let meta = await sharp(sourceFileName).metadata();
  let metaHash = createHash("sha1").update(JSON.stringify(meta)).digest("hex");
  let name = sourceFileName.replace(config.appDirectory + "/", "");

  let params = new URLSearchParams(search);
  let args = parseParamsForSharp(params, sourceFileName);

  // A set of transforms we'll send to sharp since one import can result in
  // multiple assets
  let transforms: Transform[] = [args];

  let srcset = params.get("srcset");
  if (srcset) {
    transforms = srcset.split(",").map(width => ({
      ...args,
      width: parseInt(width, 10)
    }));
  }

  // transparent 1x1 gif
  let placeholder =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=";

  if (params.get("placeholder") != null) {
    placeholder = await getPlaceholder(name, metaHash, config);
  }

  return {
    name,
    placeholder,
    metaHash,
    transforms
  };
}

/**
 * Get everything we know about the files without actually processing them.
 */
export async function getBuildImageAssets(
  buildImage: BuildImage,
  config: RemixConfig
): Promise<BuildImageAsset[]> {
  let sourceFilePath = path.join(config.appDirectory, buildImage.name);
  let sourceFileMeta = await sharp(sourceFilePath).metadata();

  return Promise.all(
    buildImage.transforms.map(async transform => {
      return getBuildImageAsset(transform, buildImage, sourceFileMeta);
    })
  );
}

/**
 * Gets the asset buffer either from the config.browserBuildDirectory or
 * generates a new one if it needs to
 */

export async function emitAsset(
  buildImageAsset: BuildImageAsset,
  config: RemixConfig
): Promise<void> {
  let filePath = path.join(config.browserBuildDirectory, buildImageAsset.name);

  if (await assetExists(filePath)) {
    log("img exists, skipping", buildImageAsset.name);
  } else {
    await processBuildImageAsset(buildImageAsset, config);
  }

  if (trackingEmissions) {
    currentEmissions.add(filePath);
  }
}

let formats = ["jpeg", "avif", "png", "webp"];

/**
 * Turns url search params into an object we can pass straight into sharp.
 */
function parseParamsForSharp(
  params: URLSearchParams,
  sourceFileName: string
): Transform {
  let format = params.get("format") || path.extname(sourceFileName).slice(1);
  if (format === "jpg") format = "jpeg";

  if (
    format !== "jpeg" &&
    format !== "avif" &&
    format !== "webp" &&
    format !== "png"
  ) {
    throw new Error(`Only ${formats.join(", ")} files can be imported.`);
  }

  let width = params.get("width");
  let height = params.get("height");
  let quality = params.get("quality");

  return {
    format,
    width: width ? parseInt(width, 10) : undefined,
    height: height ? parseInt(height, 10) : undefined,
    quality: quality ? parseInt(quality, 10) : undefined
  };
}

async function getPlaceholder(
  name: string,
  metaHash: string,
  config: RemixConfig
) {
  let placeholderFileName = path.join(
    config.browserBuildDirectory,
    `${name}__${metaHash}__placeholder.txt`
  );

  try {
    let placeholder = (await fsp.readFile(placeholderFileName)).toString();
    log("img placeholder exists, skipping", name);
    return placeholder;
  } catch (e) {}

  let sourceFileName = path.join(config.appDirectory, name);

  let start = Date.now();

  let buffer = await sharp(sourceFileName)
    .resize({ width: 50 })
    .jpeg({ quality: 25 })
    .toBuffer();

  let placeholder = `data:image/jpeg;base64,${buffer.toString("base64")}`;

  await fsp.mkdir(path.dirname(placeholderFileName), { recursive: true });
  await fsp.writeFile(placeholderFileName, placeholder);

  log(`${Date.now() - start}ms: processed placeholder`, name);
  return placeholder;
}

async function assetExists(filePath: string) {
  try {
    await fsp.access(filePath);
    return true;
  } catch (e) {
    return false;
  }
}

async function getBuildImageAsset(
  transform: Transform,
  buildImage: BuildImage,
  meta: sharp.Metadata
): Promise<BuildImageAsset> {
  let name = getBuildImageAssetName(buildImage, transform);
  let format = transform.format;
  let sourceName = buildImage.name;

  // if we know both width and height already, no need to read meta data from
  // the file itself
  if (transform.width && transform.height) {
    return {
      sourceName,
      name,
      format,
      width: transform.width,
      height: transform.height,
      transform
    };
  }

  // only know width, calculate height
  if (transform.width) {
    // TODO: figure out when/if sharp's width/height are actually possible
    // undefined? I haven't seen that happen yet, the types are third party, so
    // might be wrong.
    let ratio = meta.width! / meta.height!;
    return {
      sourceName,
      name,
      format,
      width: transform.width,
      height: Math.round(transform.width / ratio),
      transform
    };
  }

  // only know height, calculate width
  if (transform.height) {
    let ratio = meta.height! / meta.width!;
    return {
      sourceName,
      format,
      height: transform.height,
      width: Math.round(transform.height / ratio),
      name,
      transform
    };
  }

  // no width or height in the transform, so use the source file
  return {
    sourceName,
    name,
    format,
    width: meta.width!,
    height: meta.height!,
    transform
  };
}

function getBuildImageAssetName(buildImage: BuildImage, transform: Transform) {
  let hash = createHash("sha1")
    .update(buildImage.metaHash)
    .update(JSON.stringify(transform))
    .digest("hex");

  let extRegex = /(\.[^/.]+$)/;
  return buildImage.name.replace(extRegex, `__${hash}.${transform.format}`);
}

async function processBuildImageAsset(
  buildImageAsset: BuildImageAsset,
  config: RemixConfig
): Promise<void> {
  let start = Date.now();

  let sourceFileName = path.join(
    config.appDirectory,
    buildImageAsset.sourceName
  );

  let { transform } = buildImageAsset;
  let image = sharp(sourceFileName);

  if (transform.width || transform.height) {
    image.resize({
      width: transform.width,
      height: transform.height
    });
  }

  // image.jpeg(), image.png(), etc.
  image[transform.format]({ quality: transform.quality });

  // ensure directory because we're doing this outside of rollup's "emitAsset"
  let filePath = path.join(config.browserBuildDirectory, buildImageAsset.name);
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await image.toFile(filePath);
  let stats = await fsp.stat(filePath);

  let time = Date.now() - start;
  console.log(
    `Built image: ${prettyMs(time)}, ${prettyBytes(stats.size)}, ${
      buildImageAsset.name
    }`
  );
}

let currentEmissions = new Set<string>();
let previousEmissions = new Set<string>();
let trackingEmissions: boolean = false;

export function trackEmissions() {
  trackingEmissions = true;
  currentEmissions.clear();
  return cleanupEmissions;
}

async function cleanupEmissions() {
  if (previousEmissions.size > 0) {
    let oldFiles = new Set(
      [...previousEmissions].filter(filePath => !currentEmissions.has(filePath))
    );

    await Promise.all(
      Array.from(oldFiles).map(async filePath => {
        await fsp.unlink(filePath);
        log("unlinked stale image", path.basename(filePath));
      })
    );
  }

  previousEmissions = new Set(currentEmissions);
}

function log(...args: any[]) {
  if (process.env.VERBOSE) {
    console.log(...args);
  }
}
