---
'@remix-run/ui':
  patch: Preserve client-set attributes on the root element across a top-frame navigation. `syncElementAttributes` previously removed any attribute on the live `<html>` that was not present in the server HTML, which discarded client-owned state such as a `class="dark"` toggle and produced a theme flash on every navigation. The function now only mirrors attributes that the server explicitly sends, leaving client-only attributes untouched. Exposed for the regression test only, marked `@internal`.
