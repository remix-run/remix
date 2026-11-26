import * as form from '@remix-run/ui/form'
import type { FieldBinding } from '@remix-run/ui/form'
import type { Handle, Props, RemixNode } from 'remix/component'
import { css } from 'remix/component'

// Keep the native input type/role combinations when omitting binding-owned props.
type InputAttrs =
  Props<'input'> extends infer attrs
    ? attrs extends object
      ? Omit<attrs, 'id' | 'name' | 'mix' | 'children'>
      : never
    : never

type FieldProps = InputAttrs & {
  field: FieldBinding<'text' | 'password' | 'number'>
  label: string
  children?: RemixNode
}

export function Field(handle: Handle<FieldProps>) {
  return () => {
    let { field, label, children, ...inputProps } = handle.props

    return (
      <div
        mix={css({
          marginBottom: '1rem',
          '& input, & textarea, & select': {
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '1rem',
          },
          '& textarea': { minHeight: '100px', resize: 'vertical' },
          '& input[data-touched]:invalid, & input[aria-invalid="true"]': {
            borderColor: '#e74c3c',
            background: '#fff1ef',
          },
        })}
      >
        <label
          mix={[
            form.label(field),
            css({ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }),
          ]}
        >
          {label}
        </label>
        {children ?? <input {...inputProps} mix={form.control(field)} />}
        {field.errors.length > 0 && (
          <p role="alert" mix={form.error(field)}>
            {field.errors.join(' ')}
          </p>
        )}
      </div>
    )
  }
}
