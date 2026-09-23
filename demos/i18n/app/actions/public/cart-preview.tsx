import { createInstance, type TFunction } from 'i18next'
import { clientEntry, css, on, type Handle } from 'remix/ui'

import type { SupportedLanguage, TranslationTable } from '../../i18n/config.ts'

type PluralizationTranslations = TranslationTable['pluralization']

type CartPreviewProps = {
  locale: SupportedLanguage
  translations: PluralizationTranslations
}

interface CartContext {
  interactive: boolean
  quantity: number
  readonly t: TFunction
  setQuantity(quantity: number): void
}

export const CartPreview = clientEntry(
  import.meta.url,
  function CartPreview(handle: Handle<CartPreviewProps, CartContext>) {
    let i18n = createInstance()
    void i18n.init({
      initAsync: false,
      lng: handle.props.locale,
      fallbackLng: false,
      resources: {
        [handle.props.locale]: {
          translation: { pluralization: handle.props.translations },
        },
      },
      interpolation: { escapeValue: false },
    })

    let cart: CartContext = {
      interactive: false,
      quantity: 0,
      t: i18n.getFixedT(handle.props.locale),
      setQuantity(nextQuantity) {
        let normalizedQuantity = Number.isFinite(nextQuantity)
          ? Math.max(0, Math.trunc(nextQuantity))
          : 0
        if (normalizedQuantity === cart.quantity) return

        cart.quantity = normalizedQuantity
        handle.update()
      },
    }
    handle.context.set(cart)

    handle.queueTask(() => {
      cart.interactive = true
      handle.update()
    })

    return () => (
      <div mix={cartStyle}>
        <CartHeading />
        <CartQuantity />
        <CartSummary />
      </div>
    )
  },
)

function CartHeading(handle: Handle) {
  let cart = handle.context.get(CartPreview)

  return () => <h3 mix={headingStyle}>{cart.t('pluralization.cart_demo.title')}</h3>
}

function CartQuantity(handle: Handle) {
  let cart = handle.context.get(CartPreview)

  return () => (
    <div mix={quantityStyle}>
      <button
        type="button"
        aria-label={cart.t('pluralization.cart_demo.decrease')}
        disabled={!cart.interactive || cart.quantity === 0}
        mix={[quantityButtonStyle, on('click', () => cart.setQuantity(cart.quantity - 1))]}
      >
        −
      </button>
      <label mix={quantityLabelStyle}>
        <span>{cart.t('pluralization.cart_demo.quantity_label')}</span>
        <input
          type="number"
          min="0"
          step="1"
          value={cart.quantity}
          disabled={!cart.interactive}
          mix={[
            quantityInputStyle,
            on('input', (event) => cart.setQuantity(event.currentTarget.valueAsNumber)),
          ]}
        />
      </label>
      <button
        type="button"
        aria-label={cart.t('pluralization.cart_demo.increase')}
        disabled={!cart.interactive}
        mix={[quantityButtonStyle, on('click', () => cart.setQuantity(cart.quantity + 1))]}
      >
        +
      </button>
    </div>
  )
}

function CartSummary(handle: Handle) {
  let cart = handle.context.get(CartPreview)

  return () => (
    <output aria-live="polite" aria-label={cart.t('pluralization.cart_demo.summary_label')}>
      {cart.t('pluralization.cart', { count: cart.quantity })}
    </output>
  )
}

const cartStyle = css({
  display: 'grid',
  gap: '16px',
  marginBlockStart: '20px',
  padding: '18px',
  border: '1px solid light-dark(#d7dde5, #343b45)',
  borderRadius: '10px',
  backgroundColor: 'light-dark(#f8fafc, #171b21)',
})

const headingStyle = css({
  margin: 0,
  color: 'light-dark(#111827, #f3f4f6)',
  fontSize: '16px',
})

const quantityStyle = css({
  display: 'flex',
  alignItems: 'end',
  gap: '10px',
})

const quantityLabelStyle = css({
  display: 'grid',
  gap: '6px',
  color: 'light-dark(#4b5563, #b4b8c0)',
  fontSize: '13px',
  fontWeight: 600,
})

const quantityInputStyle = css({
  inlineSize: '88px',
  minHeight: '38px',
  paddingInline: '10px',
  border: '1px solid light-dark(#c7ced8, #4b5563)',
  borderRadius: '8px',
  backgroundColor: 'light-dark(#ffffff, #11151a)',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'center',
})

const quantityButtonStyle = css({
  inlineSize: '38px',
  minHeight: '38px',
  border: '1px solid currentColor',
  borderRadius: '8px',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  fontSize: '20px',
  cursor: 'pointer',
  '&:focus-visible': {
    outline: '2px solid light-dark(#0578be, #2dacf9)',
    outlineOffset: '2px',
  },
  '&:disabled': { opacity: 0.45, cursor: 'default' },
})
