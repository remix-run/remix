import type { Handle } from 'remix/component'
import { clientEntry, on } from 'remix/component'

export const ProductQuantity = clientEntry(
  import.meta.url,
  function ProductQuantity(handle: Handle) {
    let quantity = 1
    let interactive = false

    handle.queueTask(() => {
      interactive = true
      handle.update()
    })

    return () => (
      <div className="product-quantity">
        <span>
          Quantity: <output aria-live="polite">{quantity}</output>
        </span>
        <button
          type="button"
          disabled={!interactive}
          mix={on('click', () => {
            quantity++
            handle.update()
          })}
        >
          Add one
        </button>
      </div>
    )
  },
)
