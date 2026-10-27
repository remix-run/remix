import * as form from '@remix-run/ui/form'
import type { FieldBinding } from '@remix-run/ui/form'
import type { Handle, RemixNode } from 'remix/component'

interface FieldProps {
  field: FieldBinding<'text' | 'password' | 'number'>
  label: string
  type?: 'email'
  input?: {
    autoComplete?: string
    defaultValue?: string | number
    placeholder?: string
    min?: string | number
    max?: string | number
    step?: string | number
  }
  children?: RemixNode
}

export function Field(handle: Handle<FieldProps>) {
  return () => {
    let { field, label, type, input, children } = handle.props

    return (
      <div class="form-group">
        <label mix={form.label(field)}>{label}</label>
        {children ??
          (type === 'email' ? (
            <input {...input} type="email" mix={form.control(field)} />
          ) : (
            <input {...input} mix={form.control(field)} />
          ))}
        {field.errors.length > 0 && (
          <p role="alert" mix={form.error(field)}>
            {field.errors.join(' ')}
          </p>
        )}
      </div>
    )
  }
}
