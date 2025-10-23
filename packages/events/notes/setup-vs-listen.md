# Setup vs. Listen

- Interactions need to be "setup" before their events will be dispatched
- Current design does setup/listen in one go
- But maybe we should split it up?
- No more imports for host events
- Extra step for special events
- Can still add multiple with arrays, composition isn't that bad
- `on:{type}` where `type` is the raw event type you'd pass to addEventListener

## Composition/wrapping

- No imports
- Composition still good

```tsx
function Link(props) {
  return (
    <a
      on:click={[
        ...props['on:click'],
        (event) => {
          if (event.defaultPrevented) return
          event.preventDefault()
          navigate(props.href)
        },
      ]}
      on:focus={[
        ...props['on:focus'],
        () => {
          prefetch(href)
        },
      ]}
    />
  )
}

let el = <Link on:click={() => console.log('consumer')} />
```

## Two-step Interactions

```tsx
let button = (
  <button
    // setup interactions
    with={Press}
    // listen like anything else
    on:press={() => {
      console.log('')
    }}
  />
)
```

Ancestors can listen without their own setup:

```tsx
let div = (
  <div
    on:popovertarget-toggle={() => {
      // no setup, just listens for bubbled events
      console.log("a child's popover toggled")
    }}
  >
    <button
      with={PopoverTarget}
      popovertarget="my-popover"
      on:popovertarget-toggle={() => {
        console.log('my popover toggled')
      }}
    />
  </div>
)

// similar to the load event
let div = (
  <div
    on:load={() => {
      console.log(event.currentTarget, 'loaded')
    }}
  >
    <img />
    <img />
    <img />
    <img />
  </div>
)
```

Maybe dumb for other event things

```tsx
events(Drummer, {
  'drummer:change': (event) => {},
  'drummer:kick': (event) => {},
  'drummer:snare': (event) => {},
  'drummer:hat': (event) => {},
})
```
