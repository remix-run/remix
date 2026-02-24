Correct the windows-1252 test assertion to expect the Euro sign (€) for byte 0x80.

The original assertion was changed from `€` to `\x80` in fa226ba75 to work around
a Node.js bug where TextDecoder used a Latin-1 fast path for windows-1252, skipping
the spec-defined mapping of 0x80 to U+20AC. Node 24.13.1 resolved this with proper
WHATWG Encoding Standard compliance (nodejs/node#60893, nodejs/node#61093), making
the workaround unnecessary.
