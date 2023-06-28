---
"@remix-run/dev": patch
---

Do not clear screen when dev server starts

On some terminal emulators, "clearing" only scrolls the next line to the
top. on others, it erases the scrollback.

Instead, let users call `clear` themselves (`clear && remix dev`) if
they want to clear.
