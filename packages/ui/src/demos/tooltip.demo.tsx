import { css } from '@remix-run/component'
import * as tooltip from '@remix-run/ui/tooltip'

const placements = ['top', 'right', 'bottom', 'left'] as const

/**
 * @name Tooltip
 * @description Grouped hover and focus tooltips with arrows on every side.
 * @layout center
 */
export default function Example() {
  return () => (
    <tooltip.GroupContext delay={400}>
      <div
        mix={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(2, auto)',
          gap: '48px 64px',
          padding: '48px',
          fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
          fontSize: '13px',
        })}
      >
        {placements.map((placement) => (
          <tooltip.Context key={placement}>
            <button type="button" mix={tooltip.trigger()}>
              {placement}
            </button>
            <div
              mix={[
                tooltip.popup({ placement, offset: 8 }),
                css({
                  margin: 0,
                  padding: '4px 8px',
                  border: 0,
                  borderRadius: '6px',
                  overflow: 'visible',
                  background: 'light-dark(#151515, #ececec)',
                  color: 'light-dark(#fff, #151515)',
                }),
              ]}
            >
              Tooltip on the {placement}
              <span
                mix={[
                  tooltip.arrow(),
                  css({
                    width: '12px',
                    height: '6px',
                    background: 'light-dark(#151515, #ececec)',
                    clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
                    // Each side overlaps the popup edge by 1px. Left and right arrows rotate about
                    // their center, so their 12px by 6px box is offset to land on the edge.
                    '&[data-side="top"]': { top: 'calc(100% - 1px)' },
                    '&[data-side="bottom"]': { bottom: 'calc(100% - 1px)', rotate: '180deg' },
                    '&[data-side="left"]': { left: 'calc(100% - 4px)', rotate: '-90deg' },
                    '&[data-side="right"]': { right: 'calc(100% - 4px)', rotate: '90deg' },
                  }),
                ]}
              />
            </div>
          </tooltip.Context>
        ))}
      </div>
    </tooltip.GroupContext>
  )
}
