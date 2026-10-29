import * as fs from 'node:fs'
import * as path from 'node:path'

import type { ProductImageSource } from '../ui/product-image.tsx'
import { assets } from '../utils/assets.ts'

const imagesDirectory = path.resolve(import.meta.dirname, '../images/products')

/**
 * Locates the photo for a family, or for one presentation within it. Presentations without their
 * own photo use the family's.
 */
export function getProductPhoto(familySlug: string, presentationSlug?: string): string {
  if (presentationSlug != null) {
    let file = path.join(imagesDirectory, familySlug, `${presentationSlug}.webp`)
    if (fs.existsSync(file)) return file
  }

  return path.join(imagesDirectory, `${familySlug}.webp`)
}

/**
 * A thumbnail the browser picks at 1x or 2x for the screen's pixel density. Use it for images that
 * load lazily or as part of a grid.
 */
export async function getThumbnail(photo: string, size: number): Promise<ProductImageSource> {
  let [src, src2x] = await Promise.all([
    getResizedHref(photo, size),
    getResizedHref(photo, size * 2),
  ])

  return { src, srcset: `${src} 1x, ${src2x} 2x`, size }
}

/**
 * A single 2x image URL for an image the page also preloads. Remix's prefetch discovery ignores
 * preloads with `imagesrcset`, so the `<link rel="preload">` and the `<img>` must name one file.
 */
export async function getPreloadableImage(
  photo: string,
  size: number,
): Promise<ProductImageSource> {
  return { src: await getResizedHref(photo, size * 2), size }
}

function getResizedHref(photo: string, width: number): Promise<string> {
  return assets.getHref(photo, { transform: [['resize', String(width)]] })
}
