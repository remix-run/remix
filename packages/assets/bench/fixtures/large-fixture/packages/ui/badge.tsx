import { css } from '@remix-run/component'

const badgeStyles = css({
  display: 'inline-flex',
  fontSize: '11px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
})

interface BadgeProps {
  label: string
}

export function Badge({ label }: BadgeProps) {
  return <span mix={[badgeStyles]}>{label}</span>
}
