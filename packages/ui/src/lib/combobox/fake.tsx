// @ts-nocheck
function Select(handle) {
  let model: ListboxContext

  let open = false
  let value = ''
  let activeId: string | null = null

  return (props) => {
    let buttonId = props.id | handle.id
    return (
      <popover.context>
        <button
          id={buttonId}
          mix={[
            popover.onHideFocusTarget(),
            on(press.down, () => {
              open = true
              handle.update()
            }),
            onArrowDown((event) => {
              open = true
              activeId = model.firstId
              handle.update()
            }),
            onArrowUp((event) => {
              open = true
              activeId = model.lastId
              handle.update()
            }),
          ]}
        />
        <div
          mix={popover.surface({
            open: true,
            anchor: buttonId,
            inset: true,
            relativeTo: selectedId ? `#${selectedId}` : '[role=option]',
          })}
        >
          <listbox.context ref={(ref) => (model = ref)}>
            <div
              tabIndex={-1}
              mix={[
                popover.onShowFocusTarget(),
                listbox.list({ value, activeId, selectedId }),
                on(listbox.highlight, (event) => {
                  activeId = event.id
                  handle.update()
                }),
                on(listbox.select, (event) => {
                  value = event.value
                  let signal = await handle.update()
                  flashAttribute()
                  if (signal.aborted) return
                  open = false
                  handle.update()
                }),
              ]}
            >
              {children}
            </div>
          </listbox.context>
        </div>
        <input type="hidden" name={props.name} value={value} />
      </popover.context>
    )
  }
}

function Combobox(handle) {
  let model: ListboxContext
  let popoverRef: HTMLElement

  let activeId: string | null = null
  let inputText = ''
  let state: 'closed' | 'selecting' | 'hinting' | 'navigating' = 'idle'
  let prevState: 'closed' | 'selecting' | 'hinting' | 'navigating' = 'idle'
  let frozenChildren: RemixNode = null
  let selectedId: string | null = null
  let value = ''

  return (props) => {
    let inputId = props.id | handle.id

    handle.queueTask(() => {
      prevState = state
    })

    return (
      <popover.context>
        <input
          type="text"
          id={inputId}
          value={inputText}
          mix={[
            on(press.press, (event) => {
              if (event.pointerType === 'virtual') {
                state = 'navigating'
                handle.update()
              }
            }),
            onArrowDown((event) => {
              state = 'navigating'
              activeId = selectedId ?? model.firstId
              handle.update()
            }),
            onArrowUp((event) => {
              state = 'navigating'
              activeId = selectedId ?? model.firstId
              handle.update()
            }),
            on('input', (event) => {
              inputText = event.currentTarget.value
              state = inputText !== '' && model.match(inputText).length > 0 ? 'hinting' : 'closed'
              handle.update()
            }),
            onEscape(() => {
              let match = model.findByLabel(inputText)
              if (match) {
                value = match.value
              } else {
                inputText = ''
              }
              state = 'closed'
              handle.update()
            }),
          ]}
        />
        <div
          data-combobox-state={state}
          data-combobox-prev-state={prevState}
          mix={[
            popover.surface({
              open: state !== 'closed',
              anchor: inputId,
              inset: true,
              relativeTo: selectedId ? `#${selectedId}` : '[role=option]',
            }),
            ref((node) => {
              popoverRef = node
            }),
          ]}
        >
          <listbox.context ref={(ref) => (model = ref)}>
            <div
              tabIndex={-1}
              mix={[
                listbox.list({ value, label, activeId, selectedId, filterText: inputText }),
                on(listbox.activeChange, (event) => {
                  if (state === 'selecting') return
                  activeId = event.id // id or null
                  handle.update()
                }),
                on(listbox.select, async (event) => {
                  // prevent double selection
                  if (state === 'selecting') return

                  state = 'selecting'
                  // freeze children so parent updates don't jank the menu
                  frozenChildren = children

                  // store next label for delayed input update
                  let nextLabel = event.label

                  // update list state
                  value = event.value
                  selectedId = event.id
                  let signal = await handle.update()

                  // flash selection
                  await flashAttribute()
                  if (signal.aborted) return

                  // close popover, waiting for transition to complete
                  open = false
                  await Promise.all([
                    handle.update(),
                    waitForCssTransition(popoverRef, handle.signal),
                  ])

                  // update input label on small delay
                  await wait(60)
                  inputText = nextLabel
                  state = 'closed'
                  frozenChildren = null
                  handle.update()
                }),
              ]}
            >
              {frozenChildren || children}
            </div>
          </listbox.context>
        </div>
        <input type="hidden" name={props.name} value={value} />
      </popover.context>
    )
  }
}
