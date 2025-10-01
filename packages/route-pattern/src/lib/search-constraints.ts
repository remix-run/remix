export type SearchConstraints = Map<
  string,
  { requiredValues?: Set<string>; requireAssignment: boolean; allowBare: boolean }
>

export function parseSearchConstraints(search: string): SearchConstraints {
  let constraints: SearchConstraints = new Map()

  for (let part of search.split('&')) {
    if (part === '') continue
    let eqIndex = part.indexOf('=')
    if (eqIndex === -1) {
      // Presence-only (no '=')
      let name = decodeSearchComponent(part)
      let existing = constraints.get(name)
      if (!existing) {
        constraints.set(name, { requireAssignment: false, allowBare: true })
      }
      continue
    }

    let name = decodeSearchComponent(part.slice(0, eqIndex))
    let valuePart = part.slice(eqIndex + 1)
    let existing = constraints.get(name)
    if (!existing) {
      existing = { requireAssignment: true, allowBare: false }
      constraints.set(name, existing)
    } else {
      existing.requireAssignment = true
      existing.allowBare = false
    }

    if (valuePart.length > 0) {
      let decodedValue = decodeSearchComponent(valuePart)
      if (!existing.requiredValues) existing.requiredValues = new Set<string>()
      existing.requiredValues.add(decodedValue)
    }
  }

  return constraints
}

export function parseSearch(search: string): {
  namesWithoutAssignment: Set<string>
  namesWithAssignment: Set<string>
  valuesByKey: Map<string, Set<string>>
} {
  if (search.startsWith('?')) search = search.slice(1)

  let namesWithoutAssignment = new Set<string>(),
    namesWithAssignment = new Set<string>(),
    valuesByKey = new Map<string, Set<string>>()

  if (search.length > 0) {
    for (let part of search.split('&')) {
      if (part === '') continue
      let eqIndex = part.indexOf('=')
      if (eqIndex === -1) {
        let name = decodeSearchComponent(part)
        namesWithoutAssignment.add(name)
        continue
      }

      let name = decodeSearchComponent(part.slice(0, eqIndex))
      let valuePart = part.slice(eqIndex + 1)
      namesWithAssignment.add(name)
      let value = decodeSearchComponent(valuePart)
      let set = valuesByKey.get(name) ?? new Set<string>()
      if (!valuesByKey.has(name)) valuesByKey.set(name, set)
      set.add(value)
    }
  }

  return { namesWithoutAssignment, namesWithAssignment, valuesByKey }
}

function decodeSearchComponent(text: string): string {
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '))
  } catch {
    return text
  }
}
