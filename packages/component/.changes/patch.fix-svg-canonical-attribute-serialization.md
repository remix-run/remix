Harden SVG attribute normalization so canonical SVG attribute names are preserved consistently across server rendering, hydration, and client DOM updates.

This fixes rendering/behavior regressions caused by incorrect attribute casing (including filter and other SVG effect/geometry attributes) and improves parity with standard React/browser SVG behavior.
