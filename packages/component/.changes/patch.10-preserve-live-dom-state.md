Preserve browser-managed live state when frame DOM diffing updates interactive elements.

This keeps reloads from clobbering current UI state for reflected and form-like cases such as `details[open]`, `dialog[open]`, `input.checked`, editable input values, `textarea` values, `<select>` selection, and open popovers when the incoming HTML only changes serialized defaults.
