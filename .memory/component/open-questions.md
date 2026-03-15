# Component Open Questions

- Controlled input hydration:
  - On hydration, if a controlled input's live DOM value differs from the controlled prop value, consider dispatching `input` and/or `change` so application state can reconcile with what the user typed before hydration.
  - This may help with the "user typed into a non-hydrated controlled input before hydration finished" problem.
  - Needs careful evaluation across input types and event ordering before becoming default runtime behavior.
