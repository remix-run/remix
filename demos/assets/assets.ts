import { defineAssetsSource } from '@remix-run/assets'
import type { BuildOptions } from '@remix-run/assets'
import sharp from 'sharp'

export const source = defineAssetsSource({
  scripts: ['app/entry.tsx', 'app/worker.ts'],
  files: [
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
  ],
})

export const buildConfig = {
  source,
  workspaceRoot: '../..',
  outDir: './build/assets',
  baseUrl: '/assets',
  fileNames: '[name]-[hash]',
  manifest: './build/assets-manifest.json',
  minify: true,
  sourcemap: 'external' as const,
} as const satisfies BuildOptions

declare module '@remix-run/fetch-router' {
  interface AssetsConfig {
    files: typeof source.files
  }
}
