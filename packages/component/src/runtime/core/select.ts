export function getSelectValues(value: unknown): Set<string> | undefined {
  if (value == null) return undefined
  return new Set(Array.isArray(value) ? value.map(String) : [String(value)])
}

export function setSelectDefaultValue(
  select: HTMLSelectElement,
  value: unknown,
  scalar = !select.multiple,
): void {
  let values = getSelectValues(value)
  let options = Array.from(select.options)
  let matched = false
  for (let option of options) {
    let selected = (values?.has(option.value) ?? false) && !(scalar && matched)
    if (selected) matched = true
    option.defaultSelected = selected
    option.selected = selected
  }
  if (!select.multiple && !matched) {
    let firstEnabled = options.find((option) => !option.disabled)
    if (firstEnabled) firstEnabled.selected = true
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
