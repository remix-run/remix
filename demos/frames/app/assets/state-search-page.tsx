import { clientEntry, Frame, css, on, ref, type Handle } from 'remix/component'
import { routes } from '../routes.ts'

let moduleUrl = '/assets/state-search-page.js#StateSearchPage'
export let StateSearchPage = clientEntry(moduleUrl, (handle: Handle, setup?: string) => {
  let query = setup || ''
  let input: HTMLInputElement

  return () => (
    <section>
      <form
        mix={[
          on('submit', async (event) => {
            event.preventDefault()
            query = input.value.trim()
            await handle.update()
            input.select()
          }),
          css({ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }),
        ]}
      >
        <label mix={[css({ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 320px' })]}>
          <span mix={[css({ fontSize: 13, color: '#b9c6ff' })]}>Search states</span>
          <input
            placeholder="Try: carolina, dakota, new"
            mix={[
              ref((node) => (input = node)),
              css({
                minWidth: 260,
                padding: '8px 10px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(255,255,255,0.04)',
                color: '#e9eefc',
              }),
            ]}
          />
        </label>
        <button
          type="submit"
          mix={[
            css({
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.06)',
              color: '#e9eefc',
              cursor: 'pointer',
              marginTop: 20,
              '&:hover': { background: 'rgba(255,255,255,0.1)' },
            }),
          ]}
        >
          Search
        </button>
      </form>

      {query.trim() ? (
        <div
          mix={[
            css({
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              padding: 12,
              background: 'rgba(255,255,255,0.03)',
            }),
          ]}
        >
          <Frame
            src={routes.frames.stateSearchResults.href(undefined, { query })}
            fallback={<div mix={[css({ color: '#9aa8e8' })]}>Searching states…</div>}
          />
        </div>
      ) : (
        <p mix={[css({ margin: 0, color: '#9aa8e8' })]}>
          Enter a state name to run the frame search.
        </p>
      )}
    </section>
  )
})
