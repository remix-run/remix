import { css } from '@remix-run/ui'
import type { RemixNode } from '@remix-run/ui'

const panelStyles = css({
  display: 'grid',
  gap: '12px',
  padding: '16px',
})

interface GridPanelProps {
  title: string
  children: RemixNode
}

export function GridPanel({ title, children }: GridPanelProps) {
  return (
    <section mix={[panelStyles]}>
      <header>{title}</header>
      {children}
    </section>
  )
}
