Fix keyed list updates that put DOM in the wrong place or threw:

- A keyed `<Fragment>` that gains children now inserts them inside the fragment. Before, they were appended after the fragment's later siblings, at the end of the list.
- A keyed component that switches from rendering `null` to rendering DOM is now placed correctly when siblings move in the same update. Before, its DOM could land inside another sibling's fragment. If a sibling after it was removed in the same update, `insertBefore` threw `NotFoundError` and the list was left half-updated.
