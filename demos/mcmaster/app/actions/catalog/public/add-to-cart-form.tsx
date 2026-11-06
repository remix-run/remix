import { clientEntry, css, on, type Handle } from 'remix/component'

import { frames, routes } from '../../../routes.ts'
import { buttonStyle, colors, inputStyle } from '../../../ui/public/theme.ts'

type Status =
  | { type: 'idle' }
  | { type: 'saving' }
  | { type: 'added'; quantity: number }
  | { type: 'error' }

/**
 * Without JavaScript this is a plain form that posts and redirects back to the part. Once
 * hydrated, it posts in the background and reloads only the cart summary frame, so the visitor
 * stays exactly where they are.
 */
export const AddToCartForm = clientEntry(
  import.meta.url,
  function AddToCartForm(handle: Handle<{ partNumber: string }>) {
    let status: Status = { type: 'idle' }

    async function submit(form: HTMLFormElement, signal: AbortSignal) {
      let body = new FormData(form)
      status = { type: 'saving' }
      handle.update()

      try {
        // The server always answers with a redirect for non-JavaScript visitors. Not following it
        // skips rendering a page that would be thrown away.
        let response = await fetch(form.action, {
          method: 'POST',
          body,
          redirect: 'manual',
          signal,
        })
        if (response.type !== 'opaqueredirect' && !response.ok)
          throw new Error('Add to cart failed')

        await handle.frames.get(frames.cartSummary)?.reload()
        status = { type: 'added', quantity: Number(body.get('quantity')) }
      } catch (error) {
        if (signal.aborted) return
        console.error(error)
        status = { type: 'error' }
      }

      handle.update()
    }

    return () => (
      <form
        method="post"
        action={routes.cart.add.href()}
        mix={[
          formStyle,
          on('submit', (event, signal) => {
            event.preventDefault()
            void submit(event.currentTarget, signal)
          }),
        ]}
      >
        <input type="hidden" name="partNumber" value={handle.props.partNumber} />
        <label mix={labelStyle}>
          Quantity
          <input
            type="number"
            name="quantity"
            defaultValue="1"
            min="1"
            max="999"
            required
            mix={inputStyle}
          />
        </label>
        <button type="submit" disabled={status.type === 'saving'} mix={buttonStyle}>
          {status.type === 'saving' ? 'Adding…' : 'Add to order'}
        </button>
        <p role="status" mix={statusStyle}>
          {status.type === 'added'
            ? `Added ${status.quantity} to your order.`
            : status.type === 'error'
              ? 'Something went wrong. Please try again.'
              : null}
        </p>
      </form>
    )
  },
)

const formStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.75rem',
})

const labelStyle = css({ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' })

const statusStyle = css({ flexBasis: '100%', minHeight: '1.4em', margin: 0, color: colors.accent })
