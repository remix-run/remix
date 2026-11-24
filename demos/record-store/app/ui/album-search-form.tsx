import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import { routes } from '../routes.ts'

export function AlbumSearchForm(handle: Handle<{ query?: string }>) {
  return () => (
    <form
      action={routes.search.href()}
      method="GET"
      mix={css({ display: 'flex', alignItems: 'end', gap: '0.5rem' })}
    >
      <label
        for={`${handle.id}-search`}
        mix={css({
          display: 'flex',
          flex: 1,
          minWidth: 0,
          flexDirection: 'column',
          gap: '0.25rem',
        })}
      >
        Search records
        <input
          id={`${handle.id}-search`}
          type="search"
          name="q"
          placeholder="Title, artist, or description"
          defaultValue={handle.props.query}
          mix={css({ minWidth: 0, padding: '0.5rem' })}
        />
      </label>
      <button type="submit" class="btn">
        Search
      </button>
    </form>
  )
}
