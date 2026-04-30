Add `expect` API alongside the existing `assert.*` functions

- `expect(value).toBe(expected)`
  - `toBe`, `toEqual`, `toBeNull`, `toBeUndefined`, `toBeDefined`, `toBeTruthy`, `toBeInstanceOf`
  - Numbers: `toBeGreaterThan`, `toBeGreaterThanOrEqual`, `toBeLessThan`, `toBeLessThanOrEqual`, `toBeCloseTo`
  - Strings / iterables: `toContain`, `toMatch`, `toHaveLength`
  - Object shape: `toHaveProperty`, (recursive partial equality)
  - Throwing: `toThrow`
  - Mock-aware (works with `mock.fn()` / `mock.method()` from `@remix-run/test`): `toHaveBeenCalled`, `toHaveBeenCalledTimes`, `toHaveBeenCalledWith`, `toHaveBeenNthCalledWith`
  - Partial matching: `expect(value).toMatchObject(expected)`, `expect(value).toEqual(expect.objectContaining(expected))`
