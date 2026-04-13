Fix controlled `<select>` restore timing so `change` handlers can read and commit the newly selected value.

When a browser dispatches `input` before `change` for a select interaction, Remix Component now defers controlled restoration for selects to the `change` phase instead of restoring on `input`, which prevents stale controlled values from clobbering the pending selection before app handlers run.
