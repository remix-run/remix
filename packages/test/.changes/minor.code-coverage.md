Add code coverage reporting to `remix-test`

- You can enable coverage with default settings vis `remix-test --coverage` or setting `coverage:true` in your `remix-test.config.ts`
- Or you can specify individual coverage settings via the following config fields:
  - `coverage.dir`: Directory to store coverage information (default `.coverage`)
  - `coverage.include`: Array of globs for files to include in coverage
  - `coverage.exclude`: Array of globs for files to exclude from coverage
  - `coverage.statements`: Percentage threshold for statement coverage
  - `coverage.lines`: Percentage threshold for line coverage
  - `coverage.branches`: Percentage threshold for branch coverage
  - `coverage.functions`: Percentage threshold for function coverage
