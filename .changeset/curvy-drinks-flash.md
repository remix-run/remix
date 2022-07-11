---
"@remix-run/react": patch
---

When an action is omitted from`<Form>`or`useFormAction`, the resolved action would be the current location but the search string was omitted. This was a bug, and the search params will now be included in the form's action attribute.
