Reduced browser JavaScript for route maps by keeping string route definitions lazy for `href()` generation and only materializing parsed route patterns when matching APIs read `route.pattern`.

Reduced browser JavaScript for route maps further by compacting internal route-pattern serialization used when joining route definitions.
