---
title: Animation
description: The CSS-first animation model and Remix component helpers for motion that respects rendering state.
---

## CSS-first visual states {#css-first-visual-states}

Start with CSS when the browser already owns the state. Hover, focus, active, checked, open, selected, and reduced-motion states do not need JavaScript state unless your render output also depends on them.

```tsx filename=app/ui/pressable-card.tsx
import { css } from "remix/component";
import type { Handle, RemixNode } from "remix/component";

export function PressableCard(handle: Handle<{ children: RemixNode }>) {
  return () => (
    <button mix={cardStyle} type="button">
      {handle.props.children}
    </button>
  );
}

const cardStyle = css({
  border: "1px solid #d6d6d6",
  borderRadius: "16px",
  background: "white",
  cursor: "pointer",
  font: "inherit",
  padding: "1rem",
  transition: "transform 160ms ease, box-shadow 160ms ease",
  "&:hover, &:focus-visible": {
    boxShadow: "0 12px 32px rgba(15, 17, 21, 0.14)",
    transform: "translateY(-2px)",
  },
  "&:active": {
    transform: "translateY(0)",
  },
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
  },
});
```

Use Remix animation helpers when the motion depends on rendering state: a node enters, a node exits, a keyed item moves, or an event needs an interruptible animation.

The animation helpers are provided by `@remix-run/ui`. This package is currently unstable and versioned independently. It is not available through the `remix` package, so install it separately:

```sh
npm i remix @remix-run/ui
```

```tsx
import { createMixin, css, on } from "remix/component";
import type { Handle } from "remix/component";
import { spring } from "@remix-run/ui/animation";

export function PressStateDemo(handle: Handle) {
  let pressed = false;

  function setPressed(nextPressed: boolean) {
    if (pressed === nextPressed) return;
    pressed = nextPressed;
    handle.update();
  }

  return () => (
    <div
      tabIndex={0}
      mix={[
        pressableStyles,
        onPressDown(() => {
          setPressed(true);
        }),
        onPressUp(() => {
          setPressed(false);
        }),
      ]}
    >
      <span>{pressed ? "Pressed" : "Press me"}</span>
    </div>
  );
}

const onPressDown = createMixin<HTMLElement, [handler: () => void]>(() => (handler) => [
  on("pointerdown", (event) => {
    if (event.isPrimary === false) return;
    handler();
  }),
  on("keydown", (event) => {
    if (!(event.key === "Enter" || event.key === " ") || event.repeat) return;
    event.preventDefault();
    handler();
  }),
]);

const onPressUp = createMixin<HTMLElement, [handler: () => void]>(() => (handler) => [
  on("pointerup", handler),
  on("pointerleave", handler),
  on("keyup", (event) => {
    if (!(event.key === "Enter" || event.key === " ")) return;
    event.preventDefault();
    handler();
  }),
  on("blur", handler),
]);

const pressableStyles = css({
  display: "grid",
  width: 120,
  height: 120,
  placeItems: "center",
  borderRadius: 12,
  backgroundColor: "#9911ff",
  color: "white",
  cursor: "pointer",
  fontWeight: "800",
  transition: `transform ${spring()}`,
  "&:focus": {
    outline: "4px solid rgba(0,120,255,0.7)",
    outlineOffset: 2,
  },
  "&:hover, &:focus": {
    transform: "scale(1.12)",
  },
});
```

## Entrance and exit animations {#entrance-and-exit-animations}

`animateEntrance(...)` runs when a host node is inserted. `animateExit(...)` lets a removed node stay in the DOM until its exit animation finishes.

```tsx filename=app/ui/public/notice.tsx
import { clientEntry, css, on } from "remix/component";
import { animateEntrance, animateExit, spring } from "@remix-run/ui/animation";
import type { Handle } from "remix/component";

export const Notice = clientEntry(import.meta.url, function Notice(handle: Handle) {
  let visible = true;

  return () => (
    <div>
      <button
        mix={[
          on("click", () => {
            visible = !visible;
            handle.update();
          }),
        ]}
        type="button"
      >
        Toggle notice
      </button>
      {visible && (
        <p
          key="notice"
          mix={[
            noticeStyle,
            animateEntrance({
              opacity: 0,
              transform: "translateY(8px)",
              ...spring("snappy"),
            }),
            animateExit({
              opacity: 0,
              transform: "translateY(-8px)",
              ...spring("snappy"),
            }),
          ]}
        >
          Settings saved.
        </p>
      )}
    </div>
  );
});

const noticeStyle = css({
  borderRadius: "12px",
  background: "#ecfdf5",
  color: "#065f46",
  padding: "0.75rem 1rem",
});
```

Keep keys stable when toggling between related elements. A stable key tells Remix which node is entering, exiting, or being replaced.

Pass `true` for the default opacity animation or `false` to disable a mixin without changing the surrounding `mix` array. `animateEntrance({ initial: false })` skips the first insertion for a key but still animates later insertions. If the same keyed element returns before its exit finishes, Remix reclaims that DOM node and animates it back toward its rendered styles.

```tsx
import { css, on } from "remix/component";
import type { Handle } from "remix/component";
import { animateEntrance, animateExit, spring } from "@remix-run/ui/animation";

export function NoticePresenceDemo(handle: Handle) {
  let visible = true;

  return () => (
    <div mix={stackStyles}>
      <button
        mix={[
          buttonStyles,
          on("click", () => {
            visible = !visible;
            handle.update();
          }),
        ]}
        type="button"
      >
        Toggle notice
      </button>

      {visible && (
        <p
          key="notice"
          mix={[
            noticeStyles,
            animateEntrance({
              opacity: 0,
              transform: "translateY(8px)",
              ...spring("snappy"),
            }),
            animateExit({
              opacity: 0,
              transform: "translateY(-8px)",
              ...spring("snappy"),
            }),
          ]}
        >
          Settings saved.
        </p>
      )}
    </div>
  );
}

const stackStyles = css({
  display: "grid",
  gap: "1rem",
  minWidth: "16rem",
});

const buttonStyles = css({
  border: "1px solid #d83a5a",
  borderRadius: "999px",
  background: "#d83a5a",
  color: "white",
  cursor: "pointer",
  font: "inherit",
  fontWeight: "700",
  padding: "0.7rem 1rem",
});

const noticeStyles = css({
  margin: 0,
  borderRadius: "12px",
  background: "#ecfdf5",
  color: "#065f46",
  padding: "0.75rem 1rem",
});
```

## Layout animations {#layout-animations}

`animateLayout(...)` measures a host node before and after a render, then animates the visual delta. This is the right tool for sorted lists, expanding cards, and elements that move because layout changed.

```tsx filename=app/ui/public/reorder-list.tsx
import { clientEntry, css, on } from "remix/component";
import { animateLayout, spring } from "@remix-run/ui/animation";
import type { Handle } from "remix/component";

const initialItems = ["Design", "Build", "Review"];

export const ReorderList = clientEntry(import.meta.url, function ReorderList(handle: Handle) {
  let items = initialItems;

  return () => (
    <div>
      <button
        mix={[
          on("click", () => {
            items = [...items].reverse();
            handle.update();
          }),
        ]}
        type="button"
      >
        Reverse
      </button>
      <ul mix={listStyle}>
        {items.map((item) => (
          <li key={item} mix={[itemStyle, animateLayout({ ...spring("bouncy") })]}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
});

const listStyle = css({
  display: "grid",
  gap: "0.5rem",
  listStyle: "none",
  padding: 0,
});

const itemStyle = css({
  border: "1px solid #d6d6d6",
  borderRadius: "10px",
  padding: "0.7rem 1rem",
});
```

`key` is not optional for layout animation in lists. Without stable keys, the runtime cannot know whether an item moved or a different item replaced it.

Layout animation includes size projection by default. Pass `size: false` when only position should animate and scaling the element's contents would look wrong.

```tsx
import { css } from "remix/component";
import type { Handle } from "remix/component";
import { animateLayout, spring } from "@remix-run/ui/animation";

export function ReorderingDemo(handle: Handle) {
  let order = initialOrder;

  function scheduleNextShuffle(signal: AbortSignal) {
    let timeoutId = setTimeout(async () => {
      if (signal.aborted) return;
      order = shuffle(order);
      let nextSignal = await handle.update();
      scheduleNextShuffle(nextSignal);
    }, 1000);

    signal.addEventListener("abort", () => clearTimeout(timeoutId), {
      once: true,
    });
  }

  handle.queueTask(scheduleNextShuffle);

  return () => (
    <ul mix={listStyles}>
      {order.map((backgroundColor) => (
        <li
          key={backgroundColor}
          mix={[
            itemStyles,
            animateLayout({
              ...spring({ duration: 600, bounce: 0.2 }),
            }),
          ]}
          style={{ backgroundColor }}
        />
      ))}
    </ul>
  );
}

const initialOrder = ["#ff0088", "#dd00ee", "#9911ff", "#0d63f8"];

function shuffle<item>(array: item[]): item[] {
  let result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    let current = result[i];
    result[i] = result[j];
    result[j] = current;
  }
  return result;
}

const listStyles = css({
  display: "flex",
  position: "relative",
  flexDirection: "row",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "center",
  width: 220,
  gap: 10,
  margin: 0,
  padding: 0,
  listStyle: "none",
});

const itemStyles = css({
  width: 100,
  height: 100,
  borderRadius: 10,
});
```

## Springs, tweens, and easing {#springs-tweens-and-easing}

`spring()` returns an iterator decorated for CSS transitions and Web Animations. Stringify it in CSS, spread it into animation options, or iterate it for custom JavaScript animation.

```tsx filename=app/ui/public/bouncy-switch.tsx
import { clientEntry, css, on } from "remix/component";
import { spring } from "@remix-run/ui/animation";
import type { Handle } from "remix/component";

export const BouncySwitch = clientEntry(import.meta.url, function BouncySwitch(handle: Handle) {
  let enabled = true;

  return () => (
    <button
      aria-pressed={enabled}
      mix={[
        switchStyle,
        on("click", () => {
          enabled = !enabled;
          handle.update();
        }),
      ]}
      type="button"
    >
      <span
        mix={thumbStyle}
        style={{
          transform: enabled ? "translateX(2.25rem)" : "translateX(0)",
        }}
      />
    </button>
  );
});

const switchStyle = css({
  border: 0,
  borderRadius: "999px",
  background: "#ff6b35",
  cursor: "pointer",
  padding: "0.25rem",
  width: "5rem",
});

const thumbStyle = css({
  display: "block",
  width: "2rem",
  height: "2rem",
  borderRadius: "50%",
  background: "white",
  transition: spring.transition("transform", "bouncy"),
});
```

Use `tween(...)` when you need a time-based value loop rather than CSS or WAAPI timing.

```ts filename=app/ui/public/count-up.ts
import { easings, tween } from "@remix-run/ui/animation";

export function countUp(from: number, to: number, onValue: (value: number) => void) {
  let animation = tween({ from, to, duration: 300, curve: easings.easeOut });
  animation.next();

  function tick(timestamp: number) {
    let result = animation.next(timestamp);
    onValue(result.value);

    if (!result.done) {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
}
```

Prefer CSS transitions and animation mixins for ordinary UI. Use `tween` for canvas, custom counters, or values that are not CSS properties.

```tsx
import { css, on, ref } from "remix/component";
import type { Handle } from "remix/component";
import { spring } from "@remix-run/ui/animation";
import type { SpringPreset } from "@remix-run/ui/animation";

import { dragVelocityEvents } from "./gallery/drag-release.ts";

const stageWidth = 420;
const stageHeight = 260;
const dotSize = 56;
const dotRadius = dotSize / 2;

export function SpringDragReleaseDemo(handle: Handle) {
  let stage: HTMLDivElement;
  let targetX = 310;
  let targetY = 130;
  let dotX = 110;
  let dotY = 130;
  let selectedPreset: SpringPreset = "bouncy";
  let dragging = false;
  let animating = false;
  let ignoreNextStageClick = false;
  let transitionX = String(spring(selectedPreset));
  let transitionY = String(spring(selectedPreset));

  function setTarget(event: PointerEvent | MouseEvent) {
    if (ignoreNextStageClick) {
      ignoreNextStageClick = false;
      return;
    }

    let rect = stage.getBoundingClientRect();
    targetX = clamp(event.clientX - rect.left, dotRadius, rect.width - dotRadius);
    targetY = clamp(event.clientY - rect.top, dotRadius, rect.height - dotRadius);
    handle.update();
  }

  function setDotPosition(event: PointerEvent) {
    let rect = stage.getBoundingClientRect();
    dotX = clamp(event.clientX - rect.left, dotRadius, rect.width - dotRadius);
    dotY = clamp(event.clientY - rect.top, dotRadius, rect.height - dotRadius);
  }

  return () => (
    <div mix={layoutStyle}>
      <div
        mix={[
          stageStyle,
          ref((node: HTMLDivElement) => {
            stage = node;
          }),
          on<HTMLDivElement, "click">("click", setTarget),
        ]}
      >
        <div
          aria-hidden="true"
          mix={targetStyle}
          style={{
            left: `${targetX}px`,
            top: `${targetY}px`,
            transition: `left ${spring(selectedPreset)}, top ${spring(selectedPreset)}`,
          }}
        />

        <div
          aria-label="Draggable spring dot"
          role="button"
          tabIndex={0}
          mix={[
            dotStyle,
            dragVelocityEvents(),
            on<HTMLDivElement, "pointerdown">("pointerdown", (event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              dragging = true;
              animating = false;
              ignoreNextStageClick = true;
              setDotPosition(event);
              handle.update();
            }),
            on<HTMLDivElement, "pointermove">("pointermove", (event) => {
              if (!dragging) return;
              setDotPosition(event);
              handle.update();
            }),
            on(dragVelocityEvents.release, (event) => {
              dragging = false;

              let distanceX = targetX - dotX;
              let distanceY = targetY - dotY;
              transitionX = readVelocitySpring(selectedPreset, event.velocityX, distanceX);
              transitionY = readVelocitySpring(selectedPreset, event.velocityY, distanceY);

              animating = true;
              dotX = targetX;
              dotY = targetY;
              handle.update();
            }),
            on<HTMLDivElement, "transitionend">("transitionend", () => {
              animating = false;
              handle.update();
            }),
          ]}
          style={{
            left: `${dotX}px`,
            top: `${dotY}px`,
            cursor: dragging ? "grabbing" : "grab",
            transition: animating ? `left ${transitionX}, top ${transitionY}` : "none",
          }}
        />
      </div>

      <div class="spring-demo-controls" mix={controlsStyle}>
        {(Object.keys(spring.presets) as SpringPreset[]).map((preset) => (
          <label key={preset} mix={controlLabelStyle}>
            <input
              type="radio"
              name="spring-preset"
              value={preset}
              checked={selectedPreset === preset}
              mix={on<HTMLInputElement, "change">("change", () => {
                selectedPreset = preset;
                transitionX = String(spring(selectedPreset));
                transitionY = String(spring(selectedPreset));
                handle.update();
              })}
            />
            {preset}
          </label>
        ))}
      </div>

      <p mix={hintStyle}>Click the panel to move the target. Drag and release the dot.</p>
    </div>
  );
}

function readVelocitySpring(preset: SpringPreset, velocity: number, distance: number): string {
  if (Math.abs(distance) < 1) {
    return String(spring(preset));
  }

  let normalizedVelocity = clamp(velocity / distance, -20, 20);
  return String(spring(preset, { velocity: normalizedVelocity }));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const layoutStyle = css({
  display: "grid",
  gap: "0.75rem",
  width: "min(100%, 30rem)",
});

const stageStyle = css({
  position: "relative",
  overflow: "hidden",
  width: "100%",
  maxWidth: `${stageWidth}px`,
  height: `${stageHeight}px`,
  borderRadius: "18px",
  background:
    "radial-gradient(circle at 20% 20%, rgba(14, 165, 233, 0.2), transparent 35%), #17172a",
  cursor: "crosshair",
  touchAction: "none",
});

const targetStyle = css({
  position: "absolute",
  width: `${dotSize + 18}px`,
  height: `${dotSize + 18}px`,
  border: "2px dashed rgba(233, 69, 96, 0.65)",
  borderRadius: "50%",
  transform: "translate(-50%, -50%)",
  pointerEvents: "none",
});

const dotStyle = css({
  position: "absolute",
  width: `${dotSize}px`,
  height: `${dotSize}px`,
  borderRadius: "50%",
  backgroundColor: "#0ea5e9",
  boxShadow: "0 0 20px rgba(14, 165, 233, 0.45)",
  transform: "translate(-50%, -50%)",
  userSelect: "none",
  touchAction: "none",
  "&:focus-visible": {
    outline: "3px solid rgba(255, 255, 255, 0.8)",
    outlineOffset: "3px",
  },
});

const controlsStyle = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "0.35rem",
});

const controlLabelStyle = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
  border: "1px solid #d1d5db",
  borderRadius: "999px",
  padding: "0.4rem 0.65rem",
  fontSize: "0.85rem",
});

const hintStyle = css({
  margin: 0,
  color: "#6b7280",
  fontSize: "0.85rem",
  textAlign: "center",
});
```

```tsx
import { css, on } from "remix/component";
import type { Handle } from "remix/component";
import { spring } from "@remix-run/ui/animation";

export function BouncySwitchDemo(handle: Handle) {
  let isOn = true;

  return () => (
    <button
      aria-pressed={isOn}
      mix={[
        switchStyles,
        on("click", () => {
          isOn = !isOn;
          handle.update();
        }),
      ]}
      type="button"
    >
      <span
        mix={thumbStyles}
        style={{
          transform: isOn ? "translateY(-100px)" : "translateY(0)",
          transition: isOn ? `transform ${spring()}` : `transform 800ms ${bounceEasing}`,
        }}
      />
    </button>
  );
}

const bounceEasing = `linear(0, 0.258 12%, 0.424 18.3%, 0.633 24.4%, 0.999 33.3%, 0.783 39.8%, 0.733 42.5%, 0.716 45.1%, 0.731 47.6%, 0.777 50.2%, 0.999 57.7%, 0.906 61.7%, 0.883 63.5%, 0.876 65.2%, 0.901 68.7%, 0.999 74.5%, 0.964 77.4%, 0.953 80.1%, 0.961 82.6%, 1 88.2%, 0.99 91.9%, 1)`;

const switchStyles = css({
  display: "flex",
  width: 80,
  height: 180,
  flexDirection: "column",
  justifyContent: "flex-end",
  border: 0,
  borderRadius: 50,
  backgroundColor: "#ff6b35",
  cursor: "pointer",
  padding: 10,
});

const thumbStyles = css({
  width: 60,
  height: 60,
  borderRadius: 30,
  backgroundColor: "white",
  willChange: "transform",
});
```

The UI package also keeps a gallery of smaller motion experiments. Keep this kind of broad demo in a bounded frame so it does not take over the surrounding guide page.

```tsx
import { css, on, type Handle, type RemixNode } from "remix/component";
import { DefaultAnimate } from "./gallery/default-animate.tsx";
import { EnterAnimation } from "./gallery/enter.tsx";
import { ExitAnimation } from "./gallery/exit.tsx";
import { Press } from "./gallery/press.tsx";
import { HTMLContent } from "./gallery/html-content.tsx";
import { Keyframes } from "./gallery/keyframes.tsx";
import { InterruptibleKeyframes } from "./gallery/interruptible-keyframes.tsx";
import { RollingSquare } from "./gallery/rolling-square.tsx";
import { Rotate } from "./gallery/rotate.tsx";
import { TransitionOptions } from "./gallery/transition-options.tsx";
import { Cube } from "./gallery/cube.tsx";
import { SharedLayout } from "./gallery/shared-layout.tsx";
import { AspectRatio } from "./gallery/aspect-ratio.tsx";
import { BouncySwitch } from "./gallery/bouncy-switch.tsx";
import { ColorInterpolation } from "./gallery/color-interpolation.tsx";
import { FlipToggle } from "./gallery/flip-toggle.tsx";
import { Reordering } from "./gallery/reordering.tsx";
import { MultiStateBadge } from "./gallery/multi-state-badge.tsx";
import { HoldToConfirm } from "./gallery/hold-to-confirm.tsx";
import { MaterialRipple } from "./gallery/material-ripple.tsx";

function Tile(handle: Handle<{ title: string; children: RemixNode; notes?: string }>) {
  let remountKey = 0;

  return () => {
    let { title, children, notes } = handle.props;

    return (
      <div
        mix={[
          css({
            backgroundColor: "white",
            padding: "40px",
            borderRadius: 12,
            boxShadow: "0 0 10px 0 rgba(0, 0, 0, 0.1)",
            display: "flex",
            alignItems: "center",
            flexDirection: "column",
            gap: 12,
            position: "relative",
          }),
        ]}
      >
        <button
          mix={[
            css({
              position: "absolute",
              bottom: 8,
              right: 8,
              width: 18,
              height: 18,
              padding: 0,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              opacity: 0.4,
              "&:hover": {
                opacity: 1,
              },
            }),
            on("click", () => {
              remountKey++;
              handle.update();
            }),
          ]}
          title="Replay animation"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 4v6h6M23 20v-6h-6" />
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
          </svg>
        </button>
        <h3 mix={[css({ margin: 0 })]}>{title}</h3>
        <div
          key={remountKey}
          mix={[
            css({
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 280,
            }),
          ]}
        >
          {children}
        </div>
        {notes && (
          <p
            mix={[
              css({
                margin: 0,
                fontSize: 12,
                color: "#666",
                textAlign: "center",
                maxWidth: "200px",
              }),
            ]}
          >
            {notes}
          </p>
        )}
      </div>
    );
  };
}

export function AnimationGallery() {
  return () => (
    <>
      <h1 mix={[css({ marginBottom: 0, "& + p": { marginTop: 0 } })]}>Animations</h1>
      <p>
        Most animations are adapted from <a href="https://www.motion.dev">Motion</a>. Thank you for
        your work <a href="https://motion.dev/@matt">Matt Perry</a>!
      </p>
      <div
        mix={[
          css({
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 24,
            marginTop: 40,
          }),
        ]}
      >
        <Tile title="Default Animate" notes="animateEntrance + animateLayout defaults">
          <DefaultAnimate />
        </Tile>
        <Tile title="Rolling Square" notes="CSS transition with spring() timing function">
          <RollingSquare />
        </Tile>
        <Tile title="Enter Animation" notes="animateEntrance() with spring physics">
          <EnterAnimation />
        </Tile>
        <Tile title="Exit Animation" notes="animateEntrance() + animateExit()">
          <ExitAnimation />
        </Tile>
        <Tile title="Press Interaction" notes="CSS transition + pointer/keyboard events">
          <Press />
        </Tile>
        <Tile title="HTML Content" notes="rAF loop with spring iterator for text">
          <HTMLContent />
        </Tile>
        <Tile title="Keyframes" notes="CSS @keyframes with infinite loop">
          <Keyframes />
        </Tile>
        <Tile title="Interruptible Keyframes" notes="Web Animations API with commitStyles()">
          <InterruptibleKeyframes />
        </Tile>
        <Tile title="Rotate" notes="CSS @keyframes (one-shot)">
          <Rotate />
        </Tile>
        <Tile title="Transition Options" notes="animateEntrance() with cubic-bezier + delay">
          <TransitionOptions />
        </Tile>
        <Tile title="3D Cube" notes="rAF loop with direct style manipulation">
          <Cube />
        </Tile>
        <Tile title="Shared Layout" notes="CSS Grid overlap for simultaneous enter/exit">
          <SharedLayout />
        </Tile>
        <Tile title="Aspect Ratio">
          <AspectRatio />
        </Tile>
        <Tile title="Bouncy Switch" notes="Spring up, bounce down with CSS linear()">
          <BouncySwitch />
        </Tile>
        <Tile title="FLIP Toggle" notes="animateLayout() with interruptible WAAPI">
          <FlipToggle />
        </Tile>
        <Tile title="Reordering" notes="animateLayout() with auto-shuffling list">
          <Reordering />
        </Tile>
        <Tile title="Color Interpolation" notes="sRGB vs OKLCH color space">
          <ColorInterpolation />
        </Tile>
        <Tile title="Multi-State Badge" notes="Animated icon/label swap with WAAPI shake">
          <MultiStateBadge />
        </Tile>
        <Tile title="Hold to Confirm" notes="Custom interaction with progress tracking">
          <HoldToConfirm />
        </Tile>
        <Tile title="Material Ripple" notes="Pointer-tracked ripples with enter/exit animations">
          <MaterialRipple />
        </Tile>
      </div>
    </>
  );
}
```

## Interruptible interactions {#interruptible-interactions}

Event handlers receive abort signals, and animation mixins cancel or replace in-flight work when the DOM changes again. That makes interruption the default path instead of an edge case.

For custom imperative animations, keep the current animation in setup scope and cancel it before starting the next one:

```tsx filename=app/ui/public/ripple-button.tsx
import { clientEntry, css, on, ref } from "remix/component";
import { spring } from "@remix-run/ui/animation";
import type { Handle } from "remix/component";

export const RippleButton = clientEntry(import.meta.url, function RippleButton(_handle: Handle) {
  let node: HTMLButtonElement;
  let currentAnimation: Animation | undefined;

  return () => (
    <button
      mix={[
        ref((element) => (node = element)),
        buttonStyle,
        on("pointerdown", () => {
          currentAnimation?.cancel();
          currentAnimation = node.animate(
            [{ transform: "scale(0.96)" }, { transform: "scale(1)" }],
            { ...spring("snappy") },
          );
        }),
      ]}
      type="button"
    >
      Press me
    </button>
  );
});

const buttonStyle = css({
  border: 0,
  borderRadius: "999px",
  background: "#9911ff",
  color: "white",
  cursor: "pointer",
  font: "inherit",
  fontWeight: "700",
  padding: "0.8rem 1.1rem",
});
```

CSS transitions are also interruptible: changing the target value while a transition is running makes the browser animate from the current visual state to the new one.

## Reduced-motion behavior {#reduced-motion-behavior}

Respect `prefers-reduced-motion` at the CSS boundary first. It works before JavaScript loads, applies to server-rendered frames, and covers static transitions.

```tsx filename=app/ui/motion-safe-panel.tsx
import { css } from "remix/component";
import type { Handle, RemixNode } from "remix/component";

export function MotionSafePanel(handle: Handle<{ children: RemixNode }>) {
  return () => <section mix={panelStyle}>{handle.props.children}</section>;
}

const panelStyle = css({
  opacity: 1,
  transform: "translateY(0)",
  transition: "opacity 180ms ease, transform 180ms ease",
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
    transform: "none",
  },
});
```

For JavaScript-driven motion, check the same media query before starting work:

```ts filename=app/ui/public/motion.ts
export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
```

Reduced motion does not have to mean no feedback. Prefer shorter fades, instant layout changes, or non-motion state changes when movement is not essential.
