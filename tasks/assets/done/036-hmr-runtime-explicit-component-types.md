# Type HMR runtime to make component contract explicit

Remove all `any` types from the HMR runtime and properly type the integration with `@remix-run/component` to make the intentional coupling clear and type-safe.

## Context

After investigating whether `__hmr_request_remount` was an "unnecessary wrapper," we discovered that HMR is purposefully coupled to the component package in multiple ways:

1. It calls `handle.update()` directly (not just `requestRemount`)
2. It stores handles in WeakMaps and Sets
3. It manages component lifecycle via the Handle interface

The coupling isn't accidental—it's by design. HMR is specifically built to work with Remix components. However, all the handles and component functions were typed as `any`, which:

- Hid the intentional coupling
- Prevented TypeScript from catching errors
- Made the code harder to understand
- Gave poor IDE autocomplete/hints

## Solution

Replaced all `any` types with proper types:

1. Import `Handle` type from `@remix-run/component`
2. Define proper types for HMR data structures:
   - `HmrState` - State stored per handle
   - `ComponentFunction` - Component setup functions
   - `RenderFunction` - Component render functions
   - `ComponentEntry` - Registry entries
   - `HandleMetadata` - Metadata for lookups
   - `HmrMessage` types - SSE message discriminated union
3. Type all WeakMaps, Sets, and Maps with proper generic parameters
4. Add return type annotations to all functions
5. Properly type the window augmentation for `__hmr_connected`

## Benefits

- Makes the HMR ↔ component integration explicit and visible
- Enables TypeScript error checking throughout the runtime
- Better IDE support (autocomplete, go-to-definition, etc.)
- Clearer documentation through types
- No more hidden `any` types that could mask bugs

## Architectural Decision

**Decided to keep `__hmr_request_remount` wrapper:**

The original todo suggested removing this wrapper and having transforms import `requestRemount` directly from `@remix-run/component`. After investigation, we determined this would be the wrong move because:

1. **HMR runtime is a facade** - It provides all functions that transformed code needs. This includes both HMR infrastructure (`__hmr_state`, `__hmr_setup`) and component APIs (`requestRemount`). The re-export is intentional.

2. **Single import source** - Transform code only needs `import { ... } from '/__@remix/hmr-runtime.ts'`. This is cleaner and guaranteed to exist when HMR is active.

3. **Protection from false positives** - If the transform incorrectly detects a component and adds imports from `@remix-run/component`, you get a hard error. With the re-export, if HMR is active, everything works.

4. **Coupling is intentional** - HMR already calls `handle.update()` directly. It's designed for components. Re-exporting component APIs is consistent with this design.

The typing work made this coupling explicit and visible, which was the real goal.

## Acceptance Criteria

- ✅ Import `Handle` type from `@remix-run/component`
- ✅ Define all internal HMR types (HmrState, ComponentFunction, etc.)
- ✅ Replace all `any` types in WeakMaps, Sets, and Maps
- ✅ Type all function parameters and return types
- ✅ Type SSE message handling with discriminated unions
- ✅ Properly augment window interface for `__hmr_connected`
- ✅ Zero `any` types in the entire file
- ✅ All TypeScript checks pass
- ✅ All unit tests pass (122/122)
- ✅ No linter errors
