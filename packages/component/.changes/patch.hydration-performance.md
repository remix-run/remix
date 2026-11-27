Client hydration and rendering are faster, with no changes to app code. In our 4x CPU-throttled Chromium benchmarks, hydration is 2.1x–2.8x faster (table hydration 27.6 ms → 13.3 ms total, dashboard hydration 24.2 ms → 8.6 ms total) and client list and dashboard updates do 15%–30% less scripting work.

- Hydrating matched server-rendered elements skips redundant DOM attribute and inline `style` writes (avoiding unnecessary style recalculation) while still patching mismatched attributes, styles, and property-only props.
- All-primitive interpolated text children consolidate into a single text node so hydration adopts the server text node without calling `splitText()`.
- `jsx()`, host reconciliation, and child diffing allocate fewer objects and avoid unnecessary DOM `instanceof` checks and ancestor `<select>` traversals.
