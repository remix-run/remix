`run()` now uses a default browser frame resolver when `resolveFrame` is omitted

- Therefore, all `run()` calls will enable frame reloads and frame driven navigations via the Navigation API
- The default resolver renders 4xx response bodies and rejects 5xx responses; applications can provide their own `resolveFrame` to render 5xx error UI or customize other behavior
- The `rmx-document` attribute can be used to opt out of navigation interception
