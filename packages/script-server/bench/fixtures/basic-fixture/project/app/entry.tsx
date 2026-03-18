import { css } from '@remix-run/component'
import { stableLabel } from '#packages/shared/strings'
import { GridPanel } from '@bench/ui/panel'
import { summarizeBasicFixture } from './summary.ts'

let entryStyles = css({
  display: 'grid',
  gap: '8px',
  padding: '12px',
  borderRadius: '12px',
  border: '1px solid rgba(255, 255, 255, 0.08)',
})

export function renderBasicFixture() {
  let title = summarizeBasicFixture()

  return GridPanel({
    title,
    children: (
      <article mix={[entryStyles]}>
        <h1>{title}</h1>
        <p>{stableLabel('resolver coverage')}</p>
      </article>
    ),
  })
}
