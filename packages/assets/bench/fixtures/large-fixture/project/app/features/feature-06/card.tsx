import { css } from '@remix-run/ui'
import { lookupCatalogItem } from '#packages/catalog/index.ts'
import { formatPrice } from '#packages/pricing/index.ts'
import { Badge } from '#packages/ui/badge.tsx'
import { Button } from '#packages/ui/button.tsx'
import { sectionTone } from '../../theme.ts'
import { getFeatureData06 } from './data.ts'
import { scoreFeature06 } from './model.ts'

const cardStyles = css({
  display: 'grid',
  gap: '8px',
  padding: '12px',
  borderRadius: '12px',
  border: '1px solid rgba(255, 255, 255, 0.08)',
})

export function renderFeature06() {
  let data = getFeatureData06()
  let price = scoreFeature06()
  let item = lookupCatalogItem(data.id)
  return (
    <article mix={[cardStyles]} style={{ backgroundColor: sectionTone(6) }}>
      {Badge({ label: data.group })}
      <h2>{item.name}</h2>
      <p>{item.id}</p>
      <p>{formatPrice(price)}</p>
      {Button({ label: `Buy ${data.name}` })}
    </article>
  )
}
