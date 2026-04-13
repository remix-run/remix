# Component Open Questions

- Controlled input hydration:

  - On hydration, if a controlled input's live DOM value differs from the controlled prop value, consider dispatching `input` and/or `change` so application state can reconcile with what the user typed before hydration.
  - This may help with the "user typed into a non-hydrated controlled input before hydration finished" problem.
  - Needs careful evaluation across input types and event ordering before becoming default runtime behavior.

- `createMixin` argument order:

  - Consider making `props` the first argument of the function returned from `createMixin`.
  - This may make optional mixin arguments easier to author and consume because the host props would always be in a stable first position.
  - Revisit when we next work on mixin API ergonomics and optional-argument patterns.

- `handle.querySelector` for expanded descendants:
  - Consider a `handle.querySelector`-style API that can reach through child elements and component boundaries after expansion.
  - This could help parent components/mixins discover meaningful rendered descendants without depending on static JSX inspection alone.
  - Revisit when we next work on component introspection or cross-boundary composition patterns.
