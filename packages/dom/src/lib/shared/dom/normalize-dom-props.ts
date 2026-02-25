let specialAttributeNames: Record<string, string> = {
  className: 'class',
  htmlFor: 'for',
  innerHTML: 'innerHTML',
  tabIndex: 'tabindex',
  acceptCharset: 'accept-charset',
  httpEquiv: 'http-equiv',
  xlinkHref: 'xlink:href',
  xmlLang: 'xml:lang',
  xmlSpace: 'xml:space',
}

let preserveCaseAttributeNames = new Set([
  'viewBox',
  'preserveAspectRatio',
  'gradientUnits',
  'gradientTransform',
  'patternUnits',
  'patternTransform',
  'clipPathUnits',
  'maskUnits',
  'maskContentUnits',
])

export function normalizeDomPropName(name: string) {
  if (name.startsWith('aria-') || name.startsWith('data-')) return name
  let special = specialAttributeNames[name]
  if (special) return special
  if (name.includes(':')) return name
  if (preserveCaseAttributeNames.has(name)) return name
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

export function normalizeDomProps(props: Record<string, unknown>) {
  let result = props
  for (let key in props) {
    let normalized = normalizeDomPropName(key)
    if (normalized === key) continue
    if (result === props) {
      result = { ...props }
    }
    let value = result[key]
    delete result[key]
    if (normalized in result) {
      let existing = result[normalized]
      if (typeof existing === 'string' && typeof value === 'string') {
        result[normalized] = [existing, value].filter(Boolean).join(' ')
      }
    } else {
      result[normalized] = value
    }
  }
  return result
}

export function shouldNormalizeDomProps(props: Record<string, unknown>) {
  for (let key in props) {
    if (normalizeDomPropName(key) !== key) return true
  }
  return false
}
