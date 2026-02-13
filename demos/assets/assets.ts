import { defineFiles } from '@remix-run/assets'
import sharp from 'sharp'

export const files = defineFiles([
  {
    include: 'app/images/books/**/*.png',
    variants: {
      thumbnail: (data) => ({
        data: sharp(data).resize({ width: 120 }).jpeg({ quality: 55, mozjpeg: true }).toBuffer(),
        ext: 'jpg',
      }),
      card: (data) => ({
        data: sharp(data).resize({ width: 280 }).jpeg({ quality: 62, mozjpeg: true }).toBuffer(),
        ext: 'jpg',
      }),
      hero: (data) => ({
        data: sharp(data).resize({ width: 560 }).jpeg({ quality: 72, mozjpeg: true }).toBuffer(),
        ext: 'jpg',
      }),
    },
    defaultVariant: 'card',
  },
])

declare module '@remix-run/fetch-router' {
  interface AssetsConfig {
    files: typeof files
  }
}
