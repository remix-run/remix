export function getSelectValues(value: unknown): Set<string> | undefined {
  if (value == null) return undefined
  return new Set(Array.isArray(value) ? value.map(String) : [String(value)])
}

export const optionSelectedProps = new WeakMap<HTMLOptionElement, boolean | undefined>()

export function getSelectSelection(
  options: Array<{ value: string; selected?: boolean }>,
  props: { value?: unknown; defaultValue?: unknown; multiple: boolean },
): boolean[] {
  let controlled = props.value != null
  let value = controlled ? props.value : props.defaultValue
  let values = getSelectValues(value)
  let scalar = !props.multiple || (controlled && !Array.isArray(value))
  let explicitSelection =
    !controlled && !props.multiple && options.some((option) => option.selected)
  let matched = false
  return options.map((option) => {
    if (!controlled && option.selected != null) return option.selected
    if (explicitSelection || (scalar && matched)) return false
    let selected = values?.has(option.value) ?? false
    if (selected) matched = true
    return selected
  })
}

export function setSelectDefaultValue(select: HTMLSelectElement, value: unknown): void {
  let options = Array.from(select.options)
  let selection = getSelectSelection(
    options.map((option) => {
      // Raw option HTML has no host props; capture authored defaults before adding ours.
      if (!optionSelectedProps.has(option)) {
        optionSelectedProps.set(option, option.defaultSelected ? true : undefined)
      }
      return { value: option.value, selected: optionSelectedProps.get(option) }
    }),
    { defaultValue: value, multiple: select.multiple },
  )
  for (let index = 0; index < options.length; index++) {
    let option = options[index]
    option.defaultSelected = selection[index]
    option.selected = selection[index]
  }
  if (!select.multiple && !selection.some(Boolean)) {
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
