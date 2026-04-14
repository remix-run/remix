import { css } from '@remix-run/component'
import { GridPanel } from '#packages/ui/panel'
import { palette } from './theme.ts'

const frame = css({
  color: palette.foreground,
  backgroundColor: palette.background,
  padding: '24px',
  display: 'grid',
  gap: '16px',
})

interface LayoutProps {
  title: string
  children: unknown
}

export function Layout({ title, children }: LayoutProps) {
  return <main mix={[frame]}>{GridPanel({ title, children })}</main>
}
