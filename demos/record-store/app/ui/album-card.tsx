import type { Handle } from 'remix/ui'
import { Frame, css } from 'remix/ui'

import type { Album } from '../data/schema.ts'
import { routes } from '../routes.ts'

export interface AlbumCardProps {
  album: Album
  inCart: boolean
}

export function AlbumCard(handle: Handle<AlbumCardProps>) {
  return () => {
    let { album } = handle.props

    return (
      <div class="album-card" data-test-slug={album.slug}>
        <img src={album.cover_url} alt={album.title} />
        <div class="album-card-body">
          <h3>{album.title}</h3>
          <p class="artist">by {album.artist}</p>
          <p class="price">${album.price.toFixed(2)}</p>
          <div mix={css({ display: 'flex', gap: '0.5rem', alignItems: 'center' })}>
            <a href={routes.albums.show.href({ slug: album.slug })} class="btn">
              View Details
            </a>

            <Frame src={routes.fragments.cartButton.href({ albumId: album.id })} />
          </div>
        </div>
      </div>
    )
  }
}
