import { css, ref } from 'remix/component'
import { anchor } from '@remix-run/ui/anchor'
import { theme } from '@remix-run/ui/theme'
type Placement =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'right'
  | 'right-start'
  | 'right-end'
  | 'left'
  | 'left-start'
  | 'left-end'

type Position =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'middle-center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

type Positioning = 'fixed' | 'absolute'

let placements: Array<{ label: string; value: Placement }> = [
  { label: 'Top', value: 'top' },
  { label: 'Top Start', value: 'top-start' },
  { label: 'Top End', value: 'top-end' },
  { label: 'Bottom', value: 'bottom' },
  { label: 'Bottom Start', value: 'bottom-start' },
  { label: 'Bottom End', value: 'bottom-end' },
  { label: 'Right', value: 'right' },
  { label: 'Right Start', value: 'right-start' },
  { label: 'Right End', value: 'right-end' },
  { label: 'Left', value: 'left' },
  { label: 'Left Start', value: 'left-start' },
  { label: 'Left End', value: 'left-end' },
]

let positions: Array<{ label: string; value: Position }> = [
  { label: 'Top Left', value: 'top-left' },
  { label: 'Top Center', value: 'top-center' },
  { label: 'Top Right', value: 'top-right' },
  { label: 'Middle Left', value: 'middle-left' },
  { label: 'Middle Center', value: 'middle-center' },
  { label: 'Middle Right', value: 'middle-right' },
  { label: 'Bottom Left', value: 'bottom-left' },
  { label: 'Bottom Center', value: 'bottom-center' },
  { label: 'Bottom Right', value: 'bottom-right' },
]

function setButtonPosition(button: HTMLButtonElement, position: Position) {
  button.style.top = ''
  button.style.left = ''
  button.style.right = ''
  button.style.bottom = ''
  button.style.transform = ''

  if (position === 'top-left') {
    button.style.top = '20px'
    button.style.left = '20px'
    return
  }

  if (position === 'top-center') {
    button.style.top = '20px'
    button.style.left = '50%'
    button.style.transform = 'translateX(-50%)'
    return
  }

  if (position === 'top-right') {
    button.style.top = '20px'
    button.style.right = '20px'
    return
  }

  if (position === 'middle-left') {
    button.style.top = '50%'
    button.style.left = '20px'
    button.style.transform = 'translateY(-50%)'
    return
  }

  if (position === 'middle-center') {
    button.style.top = '50%'
    button.style.left = '50%'
    button.style.transform = 'translate(-50%, -50%)'
    return
  }

  if (position === 'middle-right') {
    button.style.top = '50%'
    button.style.right = '20px'
    button.style.transform = 'translateY(-50%)'
    return
  }

  if (position === 'bottom-left') {
    button.style.bottom = '20px'
    button.style.left = '20px'
    return
  }

  if (position === 'bottom-center') {
    button.style.bottom = '20px'
    button.style.left = '50%'
    button.style.transform = 'translateX(-50%)'
    return
  }

  button.style.bottom = '20px'
  button.style.right = '20px'
}

function popoverIsOpen(popover: HTMLDivElement) {
  try {
    return popover.matches(':popover-open')
  } catch {
    return popover.getAttribute('data-rmx-popover-open') === 'true'
  }
}

let rootCss = css({
  width: 'min(100%, 50rem)',
  minHeight: '100vh',
  padding: theme.space.xl,
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.space.lg,
})

let controlsCss = css({
  width: '100%',
  padding: '40px',
  boxSizing: 'border-box',
  backgroundColor: theme.surface.lvl0,
  borderRadius: theme.radius.lg,
  boxShadow: theme.shadow.md,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.lg,
})

let sectionCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
})

let headingCss = css({
  margin: 0,
  color: theme.colors.text.primary,
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.semibold,
})

let gridCss = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: theme.space.sm,
})

let narrowGridCss = css({
  display: 'grid',
  gap: theme.space.sm,
  gridTemplateColumns: 'minmax(0, 1fr)',
  maxWidth: '15.625rem',
})

let twoColumnGridCss = css({
  display: 'grid',
  gap: theme.space.sm,
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  maxWidth: '18.75rem',
})

let positionGridCss = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: theme.space.sm,
  maxWidth: '18.75rem',
})

let optionCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  padding: `${theme.space.sm} ${theme.space.md}`,
  borderRadius: theme.radius.md,
  backgroundColor: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.subtle}`,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.medium,
  color: theme.colors.text.secondary,
  boxSizing: 'border-box',
  '& input': {
    margin: 0,
  },
})

let offsetInputCss = css({
  width: '60px',
  margin: 0,
  padding: '4px 6px',
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.sm,
  fontSize: theme.fontSize.sm,
})

let buttonCss = css({
  position: 'fixed',
  zIndex: '1',
  minWidth: 'max-content',
  padding: '12px 20px',
  border: 'none',
  borderRadius: theme.radius.md,
  backgroundColor: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.medium,
  boxShadow: theme.shadow.md,
})

let popoverCss = css({
  width: '200px',
  margin: 0,
  padding: '0 8px',
  border: `2px solid ${theme.colors.text.primary}`,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.surface.lvl0,
  boxShadow: theme.shadow.lg,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.normal,
})

let menuCss = css({
  display: 'flex',
  flexDirection: 'column',
})

let menuItemCss = css({
  padding: '16px',
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
  '&:last-child': {
    borderBottom: 'none',
  },
  '&[aria-selected="true"]': {
    backgroundColor: theme.surface.lvl3,
  },
})

let infoCss = css({
  width: '100%',
  padding: theme.space.lg,
  boxSizing: 'border-box',
  backgroundColor: theme.surface.lvl3,
  borderRadius: theme.radius.lg,
  borderLeft: `4px solid ${theme.colors.action.primary.background}`,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
})

let infoTitleCss = css({
  margin: 0,
  color: theme.colors.text.primary,
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.semibold,
})

let infoBodyCss = css({
  margin: 0,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
})

let infoBodyItalicCss = css({
  fontStyle: 'italic',
})

export default function example() {
  return () => (
    <div
      mix={[
        rootCss,
        ref((node, signal) => {
          let root = node as HTMLDivElement
          let button = root.querySelector('#anchor-demo-button')
          let popover = root.querySelector('#anchor-demo-popover')
          let insetCheckbox = root.querySelector('#anchor-demo-inset')
          let relativeToCheckbox = root.querySelector('#anchor-demo-relative-to')
          let offsetInput = root.querySelector('#anchor-demo-offset')
          let offsetXInput = root.querySelector('#anchor-demo-offset-x')
          let offsetYInput = root.querySelector('#anchor-demo-offset-y')
          let persistCheckbox = root.querySelector('#anchor-demo-persist')

          if (
            !(button instanceof HTMLButtonElement) ||
            !(popover instanceof HTMLDivElement) ||
            !(insetCheckbox instanceof HTMLInputElement) ||
            !(relativeToCheckbox instanceof HTMLInputElement) ||
            !(offsetInput instanceof HTMLInputElement) ||
            !(offsetXInput instanceof HTMLInputElement) ||
            !(offsetYInput instanceof HTMLInputElement) ||
            !(persistCheckbox instanceof HTMLInputElement)
          ) {
            return
          }

          let anchorButton = button
          let anchorPopover = popover

          let currentPlacement: Placement = 'bottom'
          let currentPosition: Position = 'middle-center'
          let currentPositioning: Positioning = 'fixed'
          let currentInset = false
          let currentRelativeTo = false
          let currentOffset = 0
          let currentOffsetX = 0
          let currentOffsetY = 0
          let currentPersist = false
          let currentCleanup: null | (() => void) = null

          function cleanupAnchor() {
            if (currentCleanup) {
              currentCleanup()
              currentCleanup = null
            }
          }

          function positionPopover() {
            cleanupAnchor()
            currentCleanup = anchor(anchorPopover, anchorButton, {
              placement: currentPlacement,
              inset: currentInset,
              relativeTo: currentRelativeTo ? '[aria-selected="true"]' : undefined,
              offset: currentOffset,
              offsetX: currentOffsetX,
              offsetY: currentOffsetY,
            })
          }

          function syncPersistentPopover() {
            if (currentPersist) {
              anchorPopover.style.display = 'block'
              positionPopover()
              return
            }

            anchorPopover.style.display = ''
            cleanupAnchor()
          }

          function updatePositioning() {
            anchorButton.style.position = currentPositioning
          }

          let placementRadios = root.querySelectorAll<HTMLInputElement>('input[name="placement"]')
          let positionRadios = root.querySelectorAll<HTMLInputElement>('input[name="position"]')
          let positioningRadios = root.querySelectorAll<HTMLInputElement>(
            'input[name="positioning"]',
          )

          for (let radio of placementRadios) {
            let onChange = () => {
              if (!radio.checked) return
              currentPlacement = radio.value as Placement
              if (currentPersist) {
                syncPersistentPopover()
              }
            }

            radio.addEventListener('change', onChange)
            signal.addEventListener('abort', () => radio.removeEventListener('change', onChange))
          }

          for (let radio of positionRadios) {
            let onChange = () => {
              if (!radio.checked) return
              currentPosition = radio.value as Position
              setButtonPosition(anchorButton, currentPosition)

              if (currentPersist) {
                syncPersistentPopover()
              }
            }

            radio.addEventListener('change', onChange)
            signal.addEventListener('abort', () => radio.removeEventListener('change', onChange))
          }

          for (let radio of positioningRadios) {
            let onChange = () => {
              if (!radio.checked) return
              currentPositioning = radio.value as Positioning
              updatePositioning()
              setButtonPosition(anchorButton, currentPosition)

              if (currentPersist) {
                syncPersistentPopover()
              }
            }

            radio.addEventListener('change', onChange)
            signal.addEventListener('abort', () => radio.removeEventListener('change', onChange))
          }

          let onInsetChange = () => {
            currentInset = insetCheckbox.checked
            if (currentPersist) {
              syncPersistentPopover()
            }
          }

          let onRelativeToChange = () => {
            currentRelativeTo = relativeToCheckbox.checked
            if (currentPersist) {
              syncPersistentPopover()
            }
          }

          let onOffsetChange = () => {
            currentOffset = Number.parseInt(offsetInput.value, 10) || 0
            if (currentPersist) {
              syncPersistentPopover()
            }
          }

          let onOffsetXChange = () => {
            currentOffsetX = Number.parseInt(offsetXInput.value, 10) || 0
            if (currentPersist) {
              syncPersistentPopover()
            }
          }

          let onOffsetYChange = () => {
            currentOffsetY = Number.parseInt(offsetYInput.value, 10) || 0
            if (currentPersist) {
              syncPersistentPopover()
            }
          }

          let onPersistChange = () => {
            currentPersist = persistCheckbox.checked
            syncPersistentPopover()
          }

          let onBeforeToggle = (event: Event) => {
            let toggleEvent = event as Event & { newState?: 'open' | 'closed' }

            if (toggleEvent.newState === 'open') {
              positionPopover()
              return
            }

            if (toggleEvent.newState === 'closed' && !currentPersist) {
              cleanupAnchor()
            }
          }

          let onKeyDown = (event: KeyboardEvent) => {
            if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
              return
            }

            event.preventDefault()

            let rect = anchorButton.getBoundingClientRect()
            let currentTop = currentPositioning === 'fixed' ? rect.top : rect.top + window.scrollY
            let currentLeft =
              currentPositioning === 'fixed' ? rect.left : rect.left + window.scrollX
            let pixels = event.shiftKey ? 10 : 100
            let nextTop = currentTop
            let nextLeft = currentLeft

            if (event.key === 'ArrowUp') nextTop -= pixels
            if (event.key === 'ArrowDown') nextTop += pixels
            if (event.key === 'ArrowLeft') nextLeft -= pixels
            if (event.key === 'ArrowRight') nextLeft += pixels

            anchorButton.style.top = `${nextTop}px`
            anchorButton.style.left = `${nextLeft}px`
            anchorButton.style.right = ''
            anchorButton.style.bottom = ''
            anchorButton.style.transform = ''

            if (currentPersist || popoverIsOpen(anchorPopover)) {
              positionPopover()
            }
          }

          insetCheckbox.addEventListener('change', onInsetChange)
          relativeToCheckbox.addEventListener('change', onRelativeToChange)
          offsetInput.addEventListener('input', onOffsetChange)
          offsetXInput.addEventListener('input', onOffsetXChange)
          offsetYInput.addEventListener('input', onOffsetYChange)
          persistCheckbox.addEventListener('change', onPersistChange)
          anchorPopover.addEventListener('beforetoggle', onBeforeToggle)
          document.addEventListener('keydown', onKeyDown)

          signal.addEventListener('abort', () => {
            insetCheckbox.removeEventListener('change', onInsetChange)
            relativeToCheckbox.removeEventListener('change', onRelativeToChange)
            offsetInput.removeEventListener('input', onOffsetChange)
            offsetXInput.removeEventListener('input', onOffsetXChange)
            offsetYInput.removeEventListener('input', onOffsetYChange)
            persistCheckbox.removeEventListener('change', onPersistChange)
            anchorPopover.removeEventListener('beforetoggle', onBeforeToggle)
            document.removeEventListener('keydown', onKeyDown)
            cleanupAnchor()
          })

          setButtonPosition(anchorButton, currentPosition)
          updatePositioning()
        }),
      ]}
    >
      <button
        id="anchor-demo-button"
        mix={buttonCss}
        popovertarget="anchor-demo-popover"
        type="button"
      >
        Click me!
      </button>

      <div id="anchor-demo-popover" mix={popoverCss} popover="auto">
        <div mix={menuCss}>
          <div mix={menuItemCss}>Option 1</div>
          <div mix={menuItemCss}>Option 2</div>
          <div aria-selected="true" mix={menuItemCss}>
            Option 3
          </div>
          <div mix={menuItemCss}>Option 4</div>
        </div>
      </div>

      <div mix={controlsCss}>
        <section mix={sectionCss}>
          <h3 mix={headingCss}>Placement Options</h3>
          <div mix={gridCss}>
            {placements.map((option) => (
              <label
                key={option.value}
                htmlFor={`anchor-demo-placement-${option.value}`}
                mix={optionCss}
              >
                <input
                  defaultChecked={option.value === 'bottom'}
                  id={`anchor-demo-placement-${option.value}`}
                  name="placement"
                  type="radio"
                  value={option.value}
                />
                {option.label}
              </label>
            ))}
          </div>
        </section>

        <section mix={sectionCss}>
          <h3 mix={headingCss}>Options</h3>
          <div mix={narrowGridCss}>
            <label htmlFor="anchor-demo-inset" mix={optionCss}>
              <input id="anchor-demo-inset" name="inset" type="checkbox" />
              Inset (inside anchor)
            </label>
            <label htmlFor="anchor-demo-relative-to" mix={optionCss}>
              <input id="anchor-demo-relative-to" name="relative-to" type="checkbox" />
              Relative to selected item
            </label>
            <label htmlFor="anchor-demo-offset" mix={optionCss}>
              <input
                defaultValue="0"
                id="anchor-demo-offset"
                max="100"
                min="0"
                mix={offsetInputCss}
                name="offset"
                type="number"
              />
              Gap (placement axis)
            </label>
            <label htmlFor="anchor-demo-offset-x" mix={optionCss}>
              <input
                defaultValue="0"
                id="anchor-demo-offset-x"
                max="100"
                min="-100"
                mix={offsetInputCss}
                name="offset-x"
                type="number"
              />
              Offset X
            </label>
            <label htmlFor="anchor-demo-offset-y" mix={optionCss}>
              <input
                defaultValue="0"
                id="anchor-demo-offset-y"
                max="100"
                min="-100"
                mix={offsetInputCss}
                name="offset-y"
                type="number"
              />
              Offset Y
            </label>
          </div>
        </section>

        <section mix={sectionCss}>
          <h3 mix={headingCss}>Button Position</h3>
          <div mix={positionGridCss}>
            {positions.map((option) => (
              <label
                key={option.value}
                htmlFor={`anchor-demo-position-${option.value}`}
                mix={optionCss}
              >
                <input
                  defaultChecked={option.value === 'middle-center'}
                  id={`anchor-demo-position-${option.value}`}
                  name="position"
                  type="radio"
                  value={option.value}
                />
                {option.label}
              </label>
            ))}
          </div>
        </section>

        <section mix={sectionCss}>
          <h3 mix={headingCss}>Positioning Mode</h3>
          <div mix={twoColumnGridCss}>
            <label htmlFor="anchor-demo-positioning-fixed" mix={optionCss}>
              <input
                defaultChecked
                id="anchor-demo-positioning-fixed"
                name="positioning"
                type="radio"
                value="fixed"
              />
              Fixed
            </label>
            <label htmlFor="anchor-demo-positioning-absolute" mix={optionCss}>
              <input
                id="anchor-demo-positioning-absolute"
                name="positioning"
                type="radio"
                value="absolute"
              />
              Absolute
            </label>
          </div>
        </section>

        <section mix={sectionCss}>
          <h3 mix={headingCss}>Development</h3>
          <div mix={narrowGridCss}>
            <label htmlFor="anchor-demo-persist" mix={optionCss}>
              <input id="anchor-demo-persist" name="persist-popover" type="checkbox" />
              Persist popover
            </label>
          </div>
        </section>
      </div>

      <div mix={infoCss}>
        <h4 mix={infoTitleCss}>How it works:</h4>
        <p mix={infoBodyCss}>
          The anchor utility automatically chooses the best placement and applies smart shifting to
          keep the popover visible. Use offset for the placement gap, then offsetX and offsetY to
          nudge the popover horizontally or vertically.
        </p>
        <p mix={infoBodyCss}>
          <strong>Interactive testing:</strong> Use arrow keys to move the button around and watch
          the popover follow automatically. Hold Shift for smaller 10px moves.
        </p>
        <p mix={[infoBodyCss, infoBodyItalicCss]}>
          <strong>Positioning modes:</strong> Fixed stays relative to the viewport. Absolute moves
          with the document. The popover automatically matches the anchor positioning mode.
        </p>
      </div>
    </div>
  )
}
