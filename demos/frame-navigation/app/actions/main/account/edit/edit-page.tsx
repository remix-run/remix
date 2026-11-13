import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import type { Account } from '../../../../data/account.ts'
import { accountConstraints } from '../../../../data/account.ts'
import { frames, routes } from '../../../../routes.ts'

export type AccountFormErrors = Partial<Record<keyof Account, string>>

type AccountEditorProps = {
  values: Account
  errors?: AccountFormErrors
}

export function AccountEditor(handle: Handle<AccountEditorProps>) {
  return () => {
    let { values, errors = {} } = handle.props

    return (
      <section
        aria-labelledby="account-heading"
        mix={css({
          maxWidth: '48rem',
        })}
      >
        <h1
          id="account-heading"
          mix={css({
            marginTop: 0,
            fontSize: '1.8rem',
            color: '#0f172a',
          })}
        >
          Edit account
        </h1>
        <p
          mix={css({
            marginTop: '0.5rem',
            color: '#475569',
            lineHeight: 1.7,
            maxWidth: '65ch',
          })}
        >
          Update the information shown in your student profile. This data is kept in memory and
          resets when the demo server restarts.
        </p>

        <form
          method="POST"
          action={routes.main.account.edit.action.href()}
          mix={css({
            marginTop: '1.25rem',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '1.25rem',
            backgroundColor: '#ffffff',
            display: 'grid',
            gap: '1rem',
          })}
        >
          <FormField
            label="Display name"
            name="displayName"
            value={values.displayName}
            error={errors.displayName}
            maxLength={accountConstraints.displayName.maxLength}
          />
          <FormField
            label="Program"
            name="program"
            value={values.program}
            error={errors.program}
            maxLength={accountConstraints.program.maxLength}
          />
          <FormField
            label="Expected graduation"
            name="expectedGraduation"
            type="month"
            value={values.expectedGraduation}
            error={errors.expectedGraduation}
            maxLength={accountConstraints.expectedGraduation.maxLength}
          />

          <button
            type="submit"
            mix={css({
              justifySelf: 'start',
              border: 'none',
              borderRadius: '999px',
              padding: '0.75rem 1rem',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: '#1e293b',
              },
            })}
          >
            Save account
          </button>
        </form>
      </section>
    )
  }
}

type FormFieldProps = {
  label: string
  name: keyof Account
  type?: 'month' | 'text'
  value: string
  error?: string
  maxLength: number
}

function FormField(handle: Handle<FormFieldProps>) {
  return () => {
    let { label, name, type = 'text', value, error, maxLength } = handle.props
    let errorId = `${name}-error`

    return (
      <div
        mix={css({
          display: 'grid',
          gap: '0.4rem',
        })}
      >
        <label
          for={name}
          mix={css({
            color: '#334155',
            fontSize: '0.9rem',
            fontWeight: 650,
          })}
        >
          {label}
        </label>
        {type === 'month' ? (
          <input
            id={name}
            name={name}
            type="month"
            value={value}
            required
            maxLength={maxLength}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? errorId : undefined}
            mix={inputStyle}
          />
        ) : (
          <input
            id={name}
            name={name}
            type="text"
            value={value}
            required
            maxLength={maxLength}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? errorId : undefined}
            mix={inputStyle}
          />
        )}
        {error ? (
          <p
            id={errorId}
            mix={css({
              margin: 0,
              color: '#b91c1c',
              fontSize: '0.875rem',
            })}
          >
            {error}
          </p>
        ) : null}
      </div>
    )
  }
}

const inputStyle = css({
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #cbd5e1',
  borderRadius: '10px',
  padding: '0.7rem 0.8rem',
  backgroundColor: '#ffffff',
  color: '#0f172a',
  font: 'inherit',
  '&:focus': {
    borderColor: '#6366f1',
    outline: '3px solid rgba(99, 102, 241, 0.2)',
  },
  '&[aria-invalid="true"]': {
    borderColor: '#dc2626',
  },
})
