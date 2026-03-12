import { css } from '@remix-run/component'
import { lookupCatalogItem } from '#packages/catalog/index'
import { formatPrice } from '#packages/pricing/index'
import { Badge } from '#packages/ui/badge'
import { Button } from '#packages/ui/button'
import { sectionTone } from '../../theme.ts'
import { getFeatureData04 } from './data.ts'
import { scoreFeature04 } from './model.ts'

let cardStyles = css({
  display: 'grid',
  gap: '8px',
  padding: '12px',
  borderRadius: '12px',
  border: '1px solid rgba(255, 255, 255, 0.08)',
})

export function renderFeature04() {
  let data = getFeatureData04()
  let price = scoreFeature04()
  let item = lookupCatalogItem(data.id)
  return (
    <article mix={[cardStyles]} style={{ backgroundColor: sectionTone(4) }}>
      {Badge({ label: data.group })}
      <h2>{item.name}</h2>
      <p>{item.id}</p>
      <p>{formatPrice(price)}</p>
      {Button({ label: `Buy ${data.name}` })}
    </article>
  )
}
