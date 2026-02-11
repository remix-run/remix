const IRREGULAR_SINGULAR_FORMS: Record<string, string> = {
  people: 'person',
  men: 'man',
  women: 'woman',
  children: 'child',
  teeth: 'tooth',
  feet: 'foot',
  geese: 'goose',
  mice: 'mouse',
  data: 'datum',
  media: 'medium',
  indices: 'index',
  vertices: 'vertex',
  analyses: 'analysis',
  statuses: 'status',
  categories: 'category',
  companies: 'company',
  addresses: 'address',
}

export function singularize(word: string): string {
  let lower = word.toLowerCase()

  if (IRREGULAR_SINGULAR_FORMS[lower]) {
    return preserveCase(word, IRREGULAR_SINGULAR_FORMS[lower])
  }

  if (lower.endsWith('ies') && lower.length > 3) {
    return preserveCase(word, word.slice(0, -3) + 'y')
  }

  if (lower.endsWith('sses') || lower.endsWith('shes') || lower.endsWith('ches')) {
    return preserveCase(word, word.slice(0, -2))
  }

  if (lower.endsWith('xes') || lower.endsWith('zes')) {
    return preserveCase(word, word.slice(0, -2))
  }

  if (lower.endsWith('s') && !lower.endsWith('ss')) {
    return preserveCase(word, word.slice(0, -1))
  }

  return word
}

export function inferForeignKey(tableName: string): string {
  let segments = tableName.split('_')
  let tail = segments.pop() ?? tableName
  let singularTail = singularize(tail)

  if (segments.length === 0) {
    return singularTail + '_id'
  }

  return [...segments, singularTail + '_id'].join('_')
}

function preserveCase(source: string, replacement: string): string {
  if (source.length === 0) {
    return replacement
  }

  if (source[0] === source[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1)
  }

  return replacement
}
