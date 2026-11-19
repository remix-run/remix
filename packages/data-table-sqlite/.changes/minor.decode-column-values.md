Query builder results now decode values SQLite stores in another form: `json()` columns are parsed with `JSON.parse()`, `boolean()` columns read as `true` or `false` instead of `1` or `0`, and `timestamp()` columns read as `Date` objects. Text in a `json()` column that is not valid JSON is returned unchanged, and `db.exec()` results keep the stored values. Code that compared these columns against `1`, `0`, or JSON text should compare against the decoded values instead.

```diff
 let settings = await db.query(userSettings).find(userId)
-if (settings.enabled === 1) applyTheme(JSON.parse(settings.data))
+if (settings.enabled) applyTheme(settings.data)
```
