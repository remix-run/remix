`run()` no longer throws on browsers without the Navigation API. Skip listener setup and fall back to `location.assign` / `location.replace` for `navigate()` (see #11641).
