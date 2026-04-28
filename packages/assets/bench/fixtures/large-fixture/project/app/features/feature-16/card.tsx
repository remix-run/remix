import { css } from '@remix-run/ui'
import { lookupCatalogItem } from '#packages/catalog/index'
import { formatPrice } from '#packages/pricing/index'
import { Badge } from '#packages/ui/badge'
import { Button } from '#packages/ui/button'
import { sectionTone } from '../../theme.ts'
import { getFeatureData16 } from './data.ts'
import { scoreFeature16 } from './model.ts'

const cardStyles = css({
  display: 'grid',
  gap: '8px',
  padding: '12px',
  borderRadius: '12px',
  border: '1px solid rgba(255, 255, 255, 0.08)',
})

export function renderFeature16() {
  let data = getFeatureData16()
  let price = scoreFeature16()
  let item = lookupCatalogItem(data.id)
  return (
    <article mix={[cardStyles]} style={{ backgroundColor: sectionTone(16) }}>
      {Badge({ label: data.group })}
      <h2>{item.name}</h2>
      <p>{item.id}</p>
      <p>{formatPrice(price)}</p>
      {Button({ label: `Buy ${data.name}` })}
    </article>
  )
}
