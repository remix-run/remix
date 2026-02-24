# @remix-run/typed-event-target

A tiny typed wrapper around `EventTarget`.

```ts
import { TypedEventTarget } from '@remix-run/typed-event-target'

type ThemeEvents = {
  change: Event
}

let theme = new TypedEventTarget<ThemeEvents>()
theme.addEventListener('change', event => {
  console.log(event.type)
})
```
