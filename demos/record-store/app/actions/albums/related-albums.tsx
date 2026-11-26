import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import type { Album } from '../../data/schema.ts'
import { AlbumCard } from '../../ui/album-card.tsx'

export function RelatedAlbums(handle: Handle<{ albums: Album[] }>) {
  return () => {
    let { albums } = handle.props

    return albums.length === 0 ? (
      <p>No other records in this category yet.</p>
    ) : (
      <div
        mix={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))',
          gap: '1.5rem',
        })}
      >
        {albums.map((album) => (
          <AlbumCard
            album={album}
            imageLoading="lazy"
            // This grid sits inside the details column with its own 240px minimum.
            imageSizes="(min-width: 1200px) 378px, (min-width: 924px) calc((100vw - 444px) / 2), (min-width: 769px) calc(100vw - 420px), (min-width: 592px) calc((100vw - 112px) / 2), calc(100vw - 88px)"
          />
        ))}
      </div>
    )
  }
}
