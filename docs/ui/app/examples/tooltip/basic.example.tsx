import * as tooltip from '@remix-run/ui/tooltip'
import { css } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExampleTooltip(
  handle: Handle<{ placement?: 'top' | 'right' | 'bottom' | 'left' }>,
) {
  return () => (
    <div
      mix={css({
        colorScheme: 'light dark',
        display: 'flex',
        justifyContent: 'center',
        color: 'light-dark(#202027, #eeeef2)',
        font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
      })}
    >
      <tooltip.Context>
        <button
          type="button"
          aria-label="Copy link"
          mix={[
            tooltip.trigger(),
            css({
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px',
              border: '1px solid light-dark(#d8d8df, #44444c)',
              borderRadius: '8px',
              background: 'light-dark(#fff, #25252b)',
              color: 'inherit',
              cursor: 'pointer',
              '&:hover, &[data-state="open"]': {
                background: 'light-dark(#f0f0f5, #303038)',
              },
              '&:focus-visible': {
                outline: '2px solid light-dark(#70707c, #a0a0ac)',
                outlineOffset: '3px',
              },
            }),
          ]}
        >
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          >
            <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
            <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
          </svg>
        </button>
        <div
          mix={[
            tooltip.popup({ placement: handle.props.placement, offset: 8 }),
            css({
              '--tooltip-bg': 'light-dark(#202027, #eeeef2)',
              margin: 0,
              padding: '4px 8px',
              border: 0,
              borderRadius: '6px',
              background: 'var(--tooltip-bg)',
              color: 'light-dark(#fff, #18181c)',
              font: '500 12px/18px "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
              overflow: 'visible',
              opacity: 0,
              transform: 'scale(0.96)',
              transition:
                'opacity 120ms ease, transform 120ms ease, display 120ms allow-discrete, overlay 120ms allow-discrete',
              '&[data-anchor-placement^="top"]': { transformOrigin: 'bottom center' },
              '&[data-anchor-placement^="bottom"]': { transformOrigin: 'top center' },
              '&[data-anchor-placement^="left"]': { transformOrigin: 'center right' },
              '&[data-anchor-placement^="right"]': { transformOrigin: 'center left' },
              '&:popover-open': {
                opacity: 1,
                transform: 'scale(1)',
                '@starting-style': { opacity: 0, transform: 'scale(0.96)' },
              },
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            }),
          ]}
        >
          Copy link
          <span
            mix={[
              tooltip.arrow(),
              css({
                width: '12px',
                height: '6px',
                background: 'var(--tooltip-bg)',
                clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
                // Overlap the popup by 1px so no subpixel seam shows between the two shapes. Side
                // arrows rotate about their center, so their 12px by 6px box shifts 3px further.
                '&[data-side="top"]': { top: 'calc(100% - 1px)' },
                '&[data-side="bottom"]': { bottom: 'calc(100% - 1px)', rotate: '180deg' },
                '&[data-side="left"]': { left: 'calc(100% - 4px)', rotate: '-90deg' },
                '&[data-side="right"]': { right: 'calc(100% - 4px)', rotate: '90deg' },
              }),
            ]}
          />
        </div>
      </tooltip.Context>
    </div>
  )
}
