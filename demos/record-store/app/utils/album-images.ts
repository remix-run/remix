import * as path from 'node:path'

import type { Album } from '../data/schema.ts'
import { assets, albumImageWidths } from './assets.ts'

export interface AlbumImage {
  src: string
  srcSet?: string
}

export interface AlbumWithCover extends Album {
  cover_srcset?: string
}

export async function getAlbumImageHref(
  href: string,
  transform: 'album-image-640' | 'album-thumbnail' = 'album-image-640',
): Promise<string> {
  if (!href.startsWith('/images/') || href === '/images/placeholder.jpg') return href

  return assets.getHref(path.resolve(import.meta.dirname, '..', href.slice(1)), {
    transform: [transform],
  })
}

export async function getAlbumImage(href: string): Promise<AlbumImage> {
  let src = await getAlbumImageHref(href)
  if (src === href) return { src }

  let candidates = await Promise.all(
    albumImageWidths.map(async (width) => {
      let url = await assets.getHref(path.resolve(import.meta.dirname, '..', href.slice(1)), {
        transform: [`album-image-${width}`],
      })
      return `${url} ${width}w`
    }),
  )
  return { src, srcSet: candidates.join(', ') }
}

export async function resolveAlbumCover(album: Album): Promise<AlbumWithCover> {
  let image = await getAlbumImage(album.cover_url)
  return { ...album, cover_url: image.src, cover_srcset: image.srcSet }
}
