BREAKING CHANGE: `target` configuration is now configured at the top level with an object format, supporting `es` version targets along with browser version targets.

Browser targets are configured with string versions such as `target: { chrome: '109', safari: '16.4' }`, and scripts can specify `es` as a year of `2015` or higher such as `target: { es: '2020' }`.

To migrate existing script configuration, replace `scripts.target` options like `scripts: { target: 'es2020' }` with `target: { es: '2020' }`.
