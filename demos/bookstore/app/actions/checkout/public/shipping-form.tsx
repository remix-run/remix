import * as form from '@remix-run/ui/form'
import type { FormSubmission } from 'remix/data-schema/form'
import { clientEntry, css } from 'remix/component'
import type { Handle } from 'remix/component'

import { routes } from '../../../routes.ts'
import { Field } from '../../../ui/public/field.tsx'
import { ShippingAddressForm } from './schema.ts'

export const ShippingFields = clientEntry(
  import.meta.url,
  function ShippingFields(handle: Handle<{ submission?: FormSubmission }>) {
    return () => (
      <form.Context
        id={handle.id}
        schema={ShippingAddressForm}
        submission={handle.props.submission}
      >
        {({ fields, errors }) => (
          <form method="POST" action={routes.checkout.action.href()} mix={form.root()}>
            {errors.form && <p role="alert">{errors.form.join(' ')}</p>}
            <Field field={fields.street} label="Street Address" />
            <Field field={fields.city} label="City" />
            <Field field={fields.state} label="State" />
            <Field field={fields.zip} label="ZIP Code" />
            <button type="submit" class="btn">
              Place Order
            </button>
            <a
              data-rmx-prefetch="intent"
              href={routes.cart.index.href()}
              class="btn btn-secondary"
              mix={css({ marginLeft: '0.5rem' })}
            >
              Back to Cart
            </a>
          </form>
        )}
      </form.Context>
    )
  },
)
