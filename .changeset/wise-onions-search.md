---
"remix": patch
"@remix-run/dev": patch
---

remove jsxDev compiler option in development as it causes a `import_jsx_dev_runtime.jsxDEV is not a function` error when building prior to running the dev server

