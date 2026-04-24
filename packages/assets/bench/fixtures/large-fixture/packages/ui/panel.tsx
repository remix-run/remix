import { css } from '@remix-run/component'
import { chunkPairs } from '../shared/arrays.ts'

const panelStyles = css({
  display: 'grid',
  gap: '16px',
})

interface GridPanelProps {
  title: string
  children: unknown
}

export function GridPanel({ title, children }: GridPanelProps) {
  let groups = chunkPairs(Array.isArray(children) ? children : [children])
  return (
    <section mix={[panelStyles]}>
      <header>{title}</header>
      {groups.flat().map((child) => child)}
    </section>
  )
}
