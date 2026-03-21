import type { MixValue, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import * as styles from './styles.ts'

interface TextFieldProps {
  id: string
  name: string
  type: 'email' | 'password' | 'text'
  label: string
  placeholder?: string
  autoComplete?: string
  defaultValue?: string
  required?: boolean
  icon?: RemixNode
  mix?: MixValue<HTMLInputElement>
}

export function TextField() {
  return (props: TextFieldProps) => {
    let inputMix =
      props.mix == null
        ? [styles.fieldInput]
        : Array.isArray(props.mix)
          ? [styles.fieldInput, ...props.mix]
          : [styles.fieldInput, props.mix]

    return (
      <div mix={css({ display: 'flex', flexDirection: 'column' })}>
        <label htmlFor={props.id} mix={styles.fieldLabel}>
          {props.label}
        </label>
        <div mix={css({ position: 'relative' })}>
          {props.icon}
          {props.type === 'email' ? (
            <input
              id={props.id}
              name={props.name}
              type="email"
              placeholder={props.placeholder}
              autoComplete={props.autoComplete}
              defaultValue={props.defaultValue}
              required={props.required}
              mix={inputMix}
            />
          ) : null}
          {props.type === 'password' ? (
            <input
              id={props.id}
              name={props.name}
              type="password"
              placeholder={props.placeholder}
              autoComplete={props.autoComplete}
              defaultValue={props.defaultValue}
              required={props.required}
              mix={inputMix}
            />
          ) : null}
          {props.type === 'text' ? (
            <input
              id={props.id}
              name={props.name}
              type="text"
              placeholder={props.placeholder}
              autoComplete={props.autoComplete}
              defaultValue={props.defaultValue}
              required={props.required}
              mix={inputMix}
            />
          ) : null}
        </div>
      </div>
    )
  }
}
