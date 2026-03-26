import { css } from '@remix-run/component'

const buttonStyles = css({
  padding: '8px 12px',
  borderRadius: '999px',
  fontSize: '12px',
  border: '1px solid rgba(255, 255, 255, 0.1)',
})

interface ButtonProps {
  label: string
}

export function Button({ label }: ButtonProps) {
  return <button mix={[buttonStyles]}>{label}</button>
}
