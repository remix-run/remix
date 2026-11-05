import * as form from '@remix-run/ui/form'
import type { FieldBinding } from '@remix-run/ui/form'
import type { Handle, Props, RemixNode } from 'remix/component'

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
      <div class="form-group">
        <label mix={form.label(field)}>{label}</label>
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
