import { defineFiles } from 'remix/assets'
import sharp from 'sharp'

export const files = defineFiles([
  {
    include: 'app/images/books/**/*.png',
    transform: (data) => ({
      data: sharp(data).jpeg({ quality: 72, mozjpeg: true }).toBuffer(),
      ext: 'jpg',
    }),
  },
])

declare module 'remix/fetch-router' {
  interface AssetsConfig {
    files: typeof files
  }
}
