export function getSelectValues(value: unknown): Set<string> | undefined {
  if (value == null) return undefined
  return new Set(Array.isArray(value) ? value.map(String) : [String(value)])
}

export function setSelectDefaultValue(select: HTMLSelectElement, value: unknown): void {
  let values = getSelectValues(value)
  for (let option of select.options) {
    option.defaultSelected = values?.has(option.value) ?? false
  }
}

export function setSelectValue(select: HTMLSelectElement, value: unknown): void {
  if (!select.multiple || !Array.isArray(value)) {
    select.value = value == null ? '' : String(value)
    return
  }
  let values = getSelectValues(value)
  for (let option of select.options) option.selected = values?.has(option.value) ?? false
}
