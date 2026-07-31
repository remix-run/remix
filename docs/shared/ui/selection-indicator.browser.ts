const indicatorYProperty = '--docs-selection-indicator-y'
const indicatorHeightProperty = '--docs-selection-indicator-height'

export function positionSelectionIndicator(container: HTMLElement, selected: HTMLElement): void {
  let containerRect = container.getBoundingClientRect()
  let selectedRect = selected.getBoundingClientRect()

  container.style.setProperty(indicatorYProperty, `${selectedRect.top - containerRect.top}px`)
  container.style.setProperty(indicatorHeightProperty, `${selectedRect.height}px`)
  container.toggleAttribute('data-has-current', true)
}

export function clearSelectionIndicator(container: HTMLElement): void {
  container.removeAttribute('data-has-current')
  container.style.removeProperty(indicatorYProperty)
  container.style.removeProperty(indicatorHeightProperty)
}
