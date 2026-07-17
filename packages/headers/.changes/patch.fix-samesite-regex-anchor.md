Fix `SetCookie` accepting invalid `SameSite` values

The `SameSite` check used `/strict|lax|none/i` as a substring test, so any value containing one of those words (e.g. `SameSite=nonesense`, `SameSite=strictly`) was accepted, capitalized, and re-serialized — violating the declared `'Strict' | 'Lax' | 'None'` type. The regex is now anchored, and invalid values fall through to `undefined` like other malformed attributes.
